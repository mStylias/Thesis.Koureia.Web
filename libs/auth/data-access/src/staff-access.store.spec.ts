import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideSynaxApi } from '@synax/client';

import { SessionStore } from './session-store';
import { StaffAccessStore } from './staff-access.store';
import type { SessionStatus } from './session-status';

const WORKSPACE_URL = 'https://api.test/api/v1/users/me/workspace';

const SHOP = { id: 'c1', name: 'Shop', timezone: null };

/** Enough of `SessionStore` for the store under test: a status, and a gate that is already open. */
function fakeSession(status: SessionStatus = 'signed-in') {
  const state = signal<SessionStatus>(status);

  return {
    status: state.asReadonly(),
    isSignedIn: () => state() === 'signed-in',
    isReady: () => state() !== 'deciding',
    whenReady: () => Promise.resolve(),
    set: (next: SessionStatus) => {
      state.set(next);
    },
  };
}

describe('StaffAccessStore', () => {
  let session: ReturnType<typeof fakeSession>;
  let access: StaffAccessStore;
  let http: HttpTestingController;

  function configure(status: SessionStatus = 'signed-in'): void {
    // Each test builds its own injector, because the session status is a provider here rather
    // than something a test can set afterwards.
    TestBed.resetTestingModule();
    session = fakeSession(status);
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideSynaxApi({ baseUrl: 'https://api.test', defaultVersion: 1 }),
        { provide: SessionStore, useValue: session },
      ],
    });
    access = TestBed.inject(StaffAccessStore);
    http = TestBed.inject(HttpTestingController);
  }

  afterEach(() => {
    http.verify();
  });

  /** Lets a pending promise settle, so the call behind an `await` is in flight. */
  function settle(): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, 0));
  }

  /**
   * Answers the call of one `resolve()`. Async because the store waits on the session before it
   * asks anything, so the request does not exist in the turn `resolve()` was called in.
   */
  async function flush(body: object): Promise<void> {
    await settle();
    http.expectOne(WORKSPACE_URL).flush(body);
  }

  it('refuses a plain customer, who has global codes and no shop', async () => {
    configure();
    const resolved = access.resolve();

    // Codes without a shop never admit anyone. Reading them as "staff" would let the whole
    // product into the workspace.
    await flush({
      company: null,
      permissions: ['appointments:create', 'services:read'],
      isPlatformAdmin: false,
    });
    await resolved;

    expect(access.canOpenWorkspace()).toBe(false);
    expect(access.company()).toBeNull();
  });

  it('admits a barber through their shop', async () => {
    configure();
    const resolved = access.resolve();

    await flush({ company: SHOP, permissions: ['appointments:read_all'], isPlatformAdmin: false });
    await resolved;

    expect(access.canOpenWorkspace()).toBe(true);
    expect(access.has('appointments:read_all')).toBe(true);
    expect(access.has('roles:read')).toBe(false);
    expect(access.company()).toEqual(SHOP);
  });

  it("reads the shop's zone when the API sends it", async () => {
    configure();
    const resolved = access.resolve();

    await flush({
      company: { ...SHOP, timezone: 'Europe/Athens' },
      permissions: [],
      isPlatformAdmin: false,
    });
    await resolved;

    expect(access.company()?.timezone).toBe('Europe/Athens');
  });

  it('admits a platform administrator who picked no shop', async () => {
    configure();
    const resolved = access.resolve();

    await flush({ company: null, permissions: ['platform:manage'], isPlatformAdmin: true });
    await resolved;

    expect(access.canOpenWorkspace()).toBe(true);
    expect(access.isPlatformAdmin()).toBe(true);
    // The API bypasses every requirement for a superadmin rather than listing the codes.
    expect(access.has('roles:read')).toBe(true);
    expect(access.company()).toBeNull();
  });

  it('reads once and answers the rest from the cache', async () => {
    configure();
    const resolved = access.resolve();

    await flush({ company: SHOP, permissions: ['roles:read'], isPlatformAdmin: false });
    await resolved;
    await access.resolve();

    http.expectNone(WORKSPACE_URL);
  });

  it('reads again on reload, and keeps the old answer until the new one arrives', async () => {
    configure();
    const resolved = access.resolve();
    await flush({ company: SHOP, permissions: ['roles:read'], isPlatformAdmin: true });
    await resolved;

    const reloaded = access.reload();
    await settle();
    expect(access.company()).toEqual(SHOP);

    http
      .expectOne(WORKSPACE_URL)
      .flush({ company: { id: 'c2', name: 'Other' }, permissions: [], isPlatformAdmin: true });
    await reloaded;

    expect(access.company()).toEqual({ id: 'c2', name: 'Other', timezone: null });
  });

  it('denies on a failed read, and does not cache the denial', async () => {
    configure();
    const first = access.resolve();
    await settle();

    http.expectOne(WORKSPACE_URL).flush('', { status: 503, statusText: 'Unavailable' });
    await first;

    expect(access.canOpenWorkspace()).toBe(false);

    // A blip must not lock a barber out until they reload, so the next navigation asks again.
    const second = access.resolve();
    await flush({ company: SHOP, permissions: ['roles:read'], isPlatformAdmin: false });
    await second;

    expect(access.canOpenWorkspace()).toBe(true);
  });

  it('asks nothing while signed out', async () => {
    configure('signed-out');

    await access.resolve();
    await settle();

    expect(access.canOpenWorkspace()).toBe(false);
    http.expectNone(WORKSPACE_URL);
  });

  // One tab, two people. The next one must not inherit the last one's permissions.
  it('drops the answer when the session ends', async () => {
    configure();
    const resolved = access.resolve();

    await flush({ company: SHOP, permissions: ['roles:read'], isPlatformAdmin: false });
    await resolved;
    expect(access.canOpenWorkspace()).toBe(true);

    session.set('signed-out');
    TestBed.tick();

    expect(access.canOpenWorkspace()).toBe(false);
    expect(access.company()).toBeNull();
  });

  it('drops the parts the endpoint did not shape, rather than trusting them', async () => {
    configure();
    const resolved = access.resolve();

    await flush({ company: { name: 'No id' }, permissions: ['roles:read', 7], isPlatformAdmin: 1 });
    await resolved;

    expect(access.company()).toBeNull();
    expect(access.isPlatformAdmin()).toBe(false);
    expect(access.has('roles:read')).toBe(true);
  });

  describe('staff', () => {
    const NIKOS = { id: 's1', displayName: 'Νίκος Π.', isActive: true };
    const ELENI = { id: 's2', displayName: 'Ελένη Κ.', isActive: false };

    it('is empty before the first read', () => {
      configure();

      expect(access.staff()).toEqual([]);
    });

    it('keeps every member in the order the API sends, inactive included', async () => {
      configure();
      const resolved = access.resolve();

      await flush({
        company: SHOP,
        permissions: [],
        isPlatformAdmin: false,
        staff: [ELENI, NIKOS],
      });
      await resolved;

      expect(access.staff()).toEqual([ELENI, NIKOS]);
    });

    it('drops the members the endpoint did not shape, and keeps the rest', async () => {
      configure();
      const resolved = access.resolve();

      await flush({
        company: SHOP,
        permissions: [],
        isPlatformAdmin: false,
        staff: [
          NIKOS,
          null,
          'NIKOS',
          { id: 7, displayName: 'Bad id', isActive: true },
          { id: 's3', isActive: true },
          { id: 's4', displayName: 'Bad flag', isActive: 'true' },
          ELENI,
        ],
      });
      await resolved;

      expect(access.staff()).toEqual([NIKOS, ELENI]);
    });

    // An older API image does not send the list. The shell must still open.
    it.each([
      ['missing', undefined],
      ['null', null],
      ['not a list', { id: 's1' }],
    ])('is empty when the list is %s', async (_, staff) => {
      configure();
      const resolved = access.resolve();

      await flush({ company: SHOP, permissions: ['roles:read'], isPlatformAdmin: false, staff });
      await resolved;

      expect(access.staff()).toEqual([]);
      expect(access.canOpenWorkspace()).toBe(true);
    });

    it('follows the shop on reload', async () => {
      configure();
      const resolved = access.resolve();
      await flush({ company: SHOP, permissions: [], isPlatformAdmin: true, staff: [NIKOS] });
      await resolved;

      const reloaded = access.reload();
      await flush({
        company: { id: 'c2', name: 'Other' },
        permissions: [],
        isPlatformAdmin: true,
        staff: [ELENI],
      });
      await reloaded;

      expect(access.staff()).toEqual([ELENI]);
    });

    it('drops the list when the session ends', async () => {
      configure();
      const resolved = access.resolve();
      await flush({ company: SHOP, permissions: [], isPlatformAdmin: false, staff: [NIKOS] });
      await resolved;

      session.set('signed-out');
      TestBed.tick();

      expect(access.staff()).toEqual([]);
    });
  });
});
