import { LOCALE_ID } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import {
  ActivatedRouteSnapshot,
  RedirectCommand,
  RouterStateSnapshot,
  provideRouter,
} from '@angular/router';
import { SessionStore, StaffAccessStore } from '@auth/data-access';

import { managementAccessGuard, managementPageGuard } from './management-access.guard';

/** Enough of `SessionStore` for the guard, plus a record of the sign-in it starts. */
function fakeSession(signedIn: boolean) {
  return {
    whenReady: () => Promise.resolve(),
    isSignedIn: () => signedIn,
    signIn: vi.fn<(returnUrl?: string) => void>(),
  };
}

/** Enough of `StaffAccessStore`. `permissions` is what the caller holds at its company. */
function fakeAccess(canOpen: boolean, permissions: readonly string[] = []) {
  return {
    resolve: () => Promise.resolve(),
    canOpenWorkspace: () => canOpen,
    has: (permission: string) => permissions.includes(permission),
  };
}

function configure(
  session: ReturnType<typeof fakeSession>,
  access: ReturnType<typeof fakeAccess>,
  locale = 'el',
): void {
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    providers: [
      provideRouter([]),
      { provide: LOCALE_ID, useValue: locale },
      { provide: SessionStore, useValue: session },
      { provide: StaffAccessStore, useValue: access },
    ],
  });
}

/** The guard reads only `state.url`, so the rest of the snapshot is never touched. */
function snapshot(url: string): RouterStateSnapshot {
  return { url } as RouterStateSnapshot;
}

const route = {} as ActivatedRouteSnapshot;

/** The address a `RedirectCommand` points at, or null for any other outcome. */
function redirectOf(result: unknown): string | null {
  return result instanceof RedirectCommand ? result.redirectTo.toString() : null;
}

describe('managementAccessGuard', () => {
  it('sends a signed-out visitor to sign-in, and back to the address they asked for', async () => {
    const session = fakeSession(false);
    configure(session, fakeAccess(false));

    const result = await TestBed.runInInjectionContext(() =>
      managementAccessGuard(route, snapshot('/management/roles')),
    );

    expect(session.signIn).toHaveBeenCalledWith('/management/roles');
    // Not a redirect: the document is on its way to Keycloak, and rendering the landing page
    // first would flash a page nobody asked for.
    expect(result).toBe(false);
  });

  it('sends a plain customer to the landing page in the language they are reading', async () => {
    const session = fakeSession(true);
    configure(session, fakeAccess(false), 'en');

    const result = await TestBed.runInInjectionContext(() =>
      managementAccessGuard(route, snapshot('/management/roles')),
    );

    expect(redirectOf(result)).toBe('/en');
    expect(session.signIn).not.toHaveBeenCalled();
  });

  // `LOCALE_ID` is a full BCP 47 tag on a real load, and the landing page is published under a
  // bare `el` or `en`.
  it('narrows a regional locale to the language the landing page is published under', async () => {
    configure(fakeSession(true), fakeAccess(false), 'el-GR');

    const result = await TestBed.runInInjectionContext(() =>
      managementAccessGuard(route, snapshot('/management')),
    );

    expect(redirectOf(result)).toBe('/el');
  });

  it('lets staff through', async () => {
    configure(fakeSession(true), fakeAccess(true, ['roles:read']));

    const result = await TestBed.runInInjectionContext(() =>
      managementAccessGuard(route, snapshot('/management/roles')),
    );

    expect(result).toBe(true);
  });
});

describe('managementPageGuard', () => {
  it('opens a page the caller holds the permission for', () => {
    configure(fakeSession(true), fakeAccess(true, ['roles:read']));

    const result = TestBed.runInInjectionContext(() =>
      managementPageGuard('roles:read')(route, snapshot('/management/roles')),
    );

    expect(result).toBe(true);
  });

  // The caller is staff, so the workspace is theirs — just not this page. Sending them out of
  // it would be a worse answer than the first page they can read.
  it('redirects to the first page the caller can open', () => {
    configure(fakeSession(true), fakeAccess(true, ['roles:read']));

    const result = TestBed.runInInjectionContext(() =>
      managementPageGuard('services:read')(route, snapshot('/management/services')),
    );

    expect(redirectOf(result)).toBe('/management/roles');
  });

  it('leaves the workspace when no page in it is readable', () => {
    configure(fakeSession(true), fakeAccess(true), 'en');

    const result = TestBed.runInInjectionContext(() =>
      managementPageGuard('services:read')(route, snapshot('/management/services')),
    );

    expect(redirectOf(result)).toBe('/en');
  });
});
