import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { SessionStore, StaffAccessStore } from '@auth/data-access';

import { StaffSignInRedirect } from './staff-sign-in-redirect';

describe('StaffSignInRedirect', () => {
  const navigateByUrl = vi.fn(() => Promise.resolve(true));

  async function run(options: { fresh: boolean; signedIn: boolean; staff: boolean }) {
    navigateByUrl.mockClear();
    const canOpenWorkspace = signal(false);

    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        { provide: Router, useValue: { navigateByUrl } },
        {
          provide: SessionStore,
          useValue: {
            consumeFreshSignIn: () => options.fresh,
            whenReady: () => Promise.resolve(),
            isSignedIn: () => options.signedIn,
          },
        },
        {
          provide: StaffAccessStore,
          useValue: {
            canOpenWorkspace,
            resolve: () => {
              canOpenWorkspace.set(options.staff);
              return Promise.resolve();
            },
          },
        },
      ],
    });

    TestBed.inject(StaffSignInRedirect).start();
    await new Promise((resolve) => setTimeout(resolve));
  }

  it('sends staff to the workspace after a sign-in', async () => {
    await run({ fresh: true, signedIn: true, staff: true });
    expect(navigateByUrl).toHaveBeenCalledWith('/management');
  });

  it('leaves a customer on the page they signed in from', async () => {
    await run({ fresh: true, signedIn: true, staff: false });
    expect(navigateByUrl).not.toHaveBeenCalled();
  });

  it('leaves staff alone on a page load that is not a sign-in', async () => {
    await run({ fresh: false, signedIn: true, staff: true });
    expect(navigateByUrl).not.toHaveBeenCalled();
  });

  it('does nothing after a cancelled sign-in', async () => {
    await run({ fresh: true, signedIn: false, staff: true });
    expect(navigateByUrl).not.toHaveBeenCalled();
  });
});
