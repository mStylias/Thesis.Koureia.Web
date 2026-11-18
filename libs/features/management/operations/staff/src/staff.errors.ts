import { inject } from '@angular/core';
import { TranslocoService } from '@jsverse/transloco';
import type { SynaxErrorMessages } from '@synax/client';
import { SYNAX_ERROR_MESSAGES } from '@synax/client';

/** The codes the page has its own copy for. */
const STAFF_ERROR_CODES = [
  'STAFF_NOT_FOUND',
  'STAFF_FETCH_FAILED',
  'STAFF_CREATE_FAILED',
  'STAFF_UPDATE_FAILED',
  'STAFF_DELETE_FAILED',
  'STAFF_INVALID_EMAIL',
  'STAFF_CANDIDATE_NOT_FOUND',
  'STAFF_CANDIDATE_RATE_LIMITED',
  'STAFF_ALREADY_MEMBER',
  'STAFF_EMPLOYED_ELSEWHERE',
  'STAFF_HAS_UPCOMING_APPOINTMENTS',
  'STAFF_IN_USE',
  'STAFF_CANNOT_CHANGE_SELF',
  'STAFF_OUTRANKS_CALLER',
  'STAFF_NOT_OWN_ROW',
  'STAFF_INVALID_JOB_TITLE',
  'STAFF_INVALID_JOINED_AT',
  'STAFF_UNKNOWN_ROLE',
  'STAFF_UNKNOWN_SERVICE',
  'STAFF_DUPLICATE_SERVICE',
  'STAFF_INVALID_WORK_HOURS',
  'STAFF_WORK_HOURS_OVERLAP',
  'STAFF_INVALID_TIME_OFF',
  'STAFF_TIME_OFF_OVERLAP',
  'STAFF_TIME_OFF_NOT_FOUND',
  'STAFF_PHOTO_INVALID',
  'SERVICE_INVALID_PRICE',
  'SERVICE_INVALID_DURATION',
  'ROLE_PERMISSION_ESCALATION',
  'ROLE_PERMISSION_NOT_TENANT_GRANTABLE',
] as const;

/**
 * The page's own copy for the codes it knows, over whatever the app registered. Provided on the
 * route, so the cards, the add dialog and the drawer resolve a refusal the same way.
 */
export function staffErrorMessages(): SynaxErrorMessages {
  const transloco = inject(TranslocoService);
  const parent = inject(SYNAX_ERROR_MESSAGES, { optional: true, skipSelf: true }) ?? {};
  const codes = Object.fromEntries(
    STAFF_ERROR_CODES.map((code) => [
      code,
      () => transloco.translate(`managementStaff.errors.${code}`),
    ]),
  );
  return { ...parent, codes: { ...parent.codes, ...codes } };
}
