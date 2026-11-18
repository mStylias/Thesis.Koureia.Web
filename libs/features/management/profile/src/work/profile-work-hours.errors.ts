import { inject } from '@angular/core';
import { TranslocoService } from '@jsverse/transloco';
import { SYNAX_ERROR_MESSAGES, type SynaxErrorMessages } from '@synax/client';

/** The refusals an hours or time-off save on this page can get. */
const WORK_HOURS_ERROR_CODES = [
  'AUTH_PERMISSION_DENIED',
  'STAFF_NOT_OWN_ROW',
  'STAFF_UPDATE_FAILED',
  'STAFF_INVALID_WORK_HOURS',
  'STAFF_WORK_HOURS_OVERLAP',
  'STAFF_INVALID_TIME_OFF',
  'STAFF_TIME_OFF_OVERLAP',
  'STAFF_TIME_OFF_NOT_FOUND',
] as const;

/**
 * The card's own copy for these codes, over whatever the app registered. The schedule lib ships
 * none, and the server's description is English.
 */
export function workHoursErrorMessages(): SynaxErrorMessages {
  const transloco = inject(TranslocoService);
  const parent = inject(SYNAX_ERROR_MESSAGES, { optional: true, skipSelf: true }) ?? {};
  const codes = Object.fromEntries(
    WORK_HOURS_ERROR_CODES.map((code) => [
      code,
      () => transloco.translate(`managementProfile.workHours.errors.${code}`),
    ]),
  );
  return { ...parent, codes: { ...parent.codes, ...codes } };
}
