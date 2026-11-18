import { inject } from '@angular/core';
import { TranslocoService } from '@jsverse/transloco';
import { SYNAX_ERROR_MESSAGES, type SynaxErrorMessages } from '@synax/client';

/** The codes the page has its own copy for. */
const COMPANY_ERROR_CODES = [
  'AUTH_PERMISSION_DENIED',
  'COMPANY_INVALID_BUSINESS_HOURS',
  'COMPANY_BUSINESS_HOURS_OVERLAP',
  'COMPANY_INVALID_HOLIDAY',
  'COMPANY_HOLIDAY_OVERLAP',
  'COMPANY_HOLIDAY_NOT_FOUND',
  'COMPANY_HOLIDAY_ENDED',
  'COMPANY_INVALID_BOOKING_RULES',
  'COMPANY_LOGO_INVALID',
  'COMPANY_PHOTO_INVALID',
  'COMPANY_PHOTO_TOO_SMALL',
  'COMPANY_INVALID_PHOTO_ALT_TEXT',
  'COMPANY_PHOTO_NOT_FOUND',
  'COMPANY_PHOTO_LIMIT_REACHED',
  'COMPANY_PHOTO_ORDER_MISMATCH',
  'COMPANY_FETCH_FAILED',
  'COMPANY_UPDATE_FAILED',
] as const;

/**
 * The page's own copy for the codes it knows, over whatever the app registered. Provided on the
 * route, so every card resolves a refusal the same way. The server's description is English.
 */
export function companyErrorMessages(): SynaxErrorMessages {
  const transloco = inject(TranslocoService);
  const parent = inject(SYNAX_ERROR_MESSAGES, { optional: true, skipSelf: true }) ?? {};
  const codes = Object.fromEntries(
    COMPANY_ERROR_CODES.map((code) => [
      code,
      () => transloco.translate(`managementCompany.errors.${code}`),
    ]),
  );
  return { ...parent, codes: { ...parent.codes, ...codes } };
}
