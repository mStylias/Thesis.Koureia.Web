import type { ActivatedRoute, Router } from '@angular/router';

import type { PasswordActionStatus } from './password-action-status.types';

/** The query parameter the BFF adds when the password page sends the person back. */
export const PASSWORD_ACTION_STATUS_PARAM = 'kc_action_status';

/** The BFF's password page, which returns to `returnUrl` with {@link PASSWORD_ACTION_STATUS_PARAM}. */
export function passwordActionHref(returnUrl: string): string {
  return `/auth/account/password?${new URLSearchParams({ returnUrl }).toString()}`;
}

/**
 * Reads how the password page ended, then removes the parameter from the address, so a reload
 * does not report it again. Returns `null` when the address carries no known status.
 *
 * Each page shows its own message, because the customer and the staff pages address the reader
 * differently.
 */
export function readPasswordActionStatus(
  route: ActivatedRoute,
  router: Router,
): PasswordActionStatus | null {
  const value = route.snapshot.queryParamMap.get(PASSWORD_ACTION_STATUS_PARAM);
  if (value === null) return null;

  void router.navigate([], {
    relativeTo: route,
    queryParams: { [PASSWORD_ACTION_STATUS_PARAM]: null },
    queryParamsHandling: 'merge',
    preserveFragment: true,
    replaceUrl: true,
  });

  return value === 'success' || value === 'error' || value === 'cancelled' ? value : null;
}
