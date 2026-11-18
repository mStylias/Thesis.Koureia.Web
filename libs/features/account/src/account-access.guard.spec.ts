import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import {
  provideRouter,
  RedirectCommand,
  type ActivatedRouteSnapshot,
  type RouterStateSnapshot,
} from '@angular/router';
import { SessionStore } from '@auth/data-access';

import { customerSignedInGuard } from './account-access.guard';

function setUp(session: { signedIn: boolean; verified: boolean }): {
  signIn: ReturnType<typeof vi.fn>;
} {
  const signIn = vi.fn();
  TestBed.configureTestingModule({
    providers: [
      provideRouter([]),
      {
        provide: SessionStore,
        useValue: {
          whenReady: () => Promise.resolve(),
          isSignedIn: signal(session.signedIn),
          isEmailVerified: signal(session.verified),
          signIn,
        },
      },
    ],
  });
  return { signIn };
}

function run(url: string): Promise<unknown> {
  return TestBed.runInInjectionContext(() =>
    customerSignedInGuard({} as ActivatedRouteSnapshot, { url } as RouterStateSnapshot),
  ) as Promise<unknown>;
}

describe('customerSignedInGuard', () => {
  it('starts sign-in and comes back to the address asked for', async () => {
    const { signIn } = setUp({ signedIn: false, verified: false });

    await expect(run('/el/account/reviews')).resolves.toBe(false);
    expect(signIn).toHaveBeenCalledWith('/el/account/reviews');
  });

  it('sends an unverified customer to the verification screen in the page language', async () => {
    setUp({ signedIn: true, verified: false });

    const result = await run('/en/account/profile');

    expect(result).toBeInstanceOf(RedirectCommand);
    expect((result as RedirectCommand).redirectTo.toString()).toBe(
      '/en/verify-email?returnUrl=%2Fen%2Faccount%2Fprofile',
    );
  });

  it('lets a verified customer through', async () => {
    setUp({ signedIn: true, verified: true });

    await expect(run('/el/account')).resolves.toBe(true);
  });
});
