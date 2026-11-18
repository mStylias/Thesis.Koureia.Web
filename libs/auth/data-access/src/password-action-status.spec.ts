import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, provideRouter, Router } from '@angular/router';

import { passwordActionHref, readPasswordActionStatus } from './password-action-status';

@Component({ template: '' })
class Page {}

async function at(url: string): Promise<{ route: ActivatedRoute; router: Router }> {
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({ providers: [provideRouter([{ path: '**', component: Page }])] });
  const router = TestBed.inject(Router);
  await router.navigateByUrl(url);
  let route = router.routerState.root;
  while (route.firstChild !== null) route = route.firstChild;
  return { route, router };
}

async function settled(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 0));
}

describe('readPasswordActionStatus', () => {
  it.each(['success', 'error', 'cancelled'] as const)(
    'reads %s and strips the parameter',
    async (status) => {
      const { route, router } = await at(`/management/profile?kc_action_status=${status}&tab=x`);

      expect(readPasswordActionStatus(route, router)).toBe(status);
      await settled();

      expect(router.url).toBe('/management/profile?tab=x');
    },
  );

  it('keeps the fragment', async () => {
    const { route, router } = await at('/management/profile?kc_action_status=success#profile');

    readPasswordActionStatus(route, router);
    await settled();

    expect(router.url).toBe('/management/profile#profile');
  });

  it('strips an unknown value and reports nothing', async () => {
    const { route, router } = await at('/management/profile?kc_action_status=other');

    expect(readPasswordActionStatus(route, router)).toBeNull();
    await settled();

    expect(router.url).toBe('/management/profile');
  });

  it('does not navigate when the address has no status', async () => {
    const { route, router } = await at('/management/profile');
    const navigate = vi.spyOn(router, 'navigate');

    expect(readPasswordActionStatus(route, router)).toBeNull();
    expect(navigate).not.toHaveBeenCalled();
  });
});

describe('passwordActionHref', () => {
  it('encodes the return address', () => {
    expect(passwordActionHref('/management/profile')).toBe(
      '/auth/account/password?returnUrl=%2Fmanagement%2Fprofile',
    );
  });
});
