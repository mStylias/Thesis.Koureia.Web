import { inject } from '@angular/core';
import { TranslocoService } from '@jsverse/transloco';
import type { SynaxErrorMessages } from '@synax/client';
import { SYNAX_ERROR_MESSAGES } from '@synax/client';

/** The codes the page has its own copy for. `LIMIT` and `DAYS` are never sent. */
const DASHBOARD_ERROR_CODES = [
  'ANALYTICS_INVALID_PERIOD',
  'ANALYTICS_INVALID_GRANULARITY',
  'ANALYTICS_STAFF_MEMBER_NOT_FOUND',
  'ANALYTICS_FETCH_FAILED',
  'COMPANY_NOT_FOUND',
] as const;

/**
 * The page's own copy for the codes it knows, over whatever the app registered. Provided on the
 * route, so the store's toasts resolve a refusal in the page's words.
 */
export function dashboardErrorMessages(): SynaxErrorMessages {
  const transloco = inject(TranslocoService);
  const parent = inject(SYNAX_ERROR_MESSAGES, { optional: true, skipSelf: true }) ?? {};
  const codes = Object.fromEntries(
    DASHBOARD_ERROR_CODES.map((code) => [
      code,
      () => transloco.translate(`managementDashboard.errors.${code}`),
    ]),
  );
  return { ...parent, codes: { ...parent.codes, ...codes } };
}
