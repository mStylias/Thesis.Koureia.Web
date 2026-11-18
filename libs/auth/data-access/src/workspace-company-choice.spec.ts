import { PLATFORM_ID, signal, type WritableSignal } from '@angular/core';
import { TestBed } from '@angular/core/testing';

import { SessionStore } from './session-store';
import type { SessionStatus } from './session-status';
import { WorkspaceCompanyChoice } from './workspace-company-choice';

const KEY = 'management.workspace-company';

describe('WorkspaceCompanyChoice', () => {
  let status: WritableSignal<SessionStatus>;

  function configure(platform = 'browser'): WorkspaceCompanyChoice {
    TestBed.resetTestingModule();
    status = signal<SessionStatus>('signed-in');
    TestBed.configureTestingModule({
      providers: [
        { provide: PLATFORM_ID, useValue: platform },
        { provide: SessionStore, useValue: { status: status.asReadonly() } },
      ],
    });
    return TestBed.inject(WorkspaceCompanyChoice);
  }

  afterEach(() => {
    sessionStorage.clear();
  });

  it('keeps the pick for the browser session', () => {
    configure().set('c1');

    expect(sessionStorage.getItem(KEY)).toBe('c1');
    expect(configure().companyId()).toBe('c1');
  });

  it('forgets the pick on sign-out', () => {
    const choice = configure();
    choice.set('c1');

    status.set('signed-out');
    TestBed.tick();

    expect(choice.companyId()).toBeNull();
    expect(sessionStorage.getItem(KEY)).toBeNull();
  });

  // The session is still being decided on every page load. Clearing then would drop the pick on
  // each reload.
  it('keeps the pick while the session is being decided', () => {
    sessionStorage.setItem(KEY, 'c1');
    const choice = configure();

    status.set('deciding');
    TestBed.tick();

    expect(choice.companyId()).toBe('c1');
  });

  it('reads nothing on the server', () => {
    sessionStorage.setItem(KEY, 'c1');

    expect(configure('server').companyId()).toBeNull();
  });

  it('keeps the pick in memory when storage refuses it', () => {
    const setItem = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('quota', 'QuotaExceededError');
    });
    const choice = configure();

    choice.set('c1');

    expect(choice.companyId()).toBe('c1');
    setItem.mockRestore();
  });
});
