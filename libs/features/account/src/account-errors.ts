import { inject } from '@angular/core';
import { TranslocoService } from '@jsverse/transloco';
import { SYNAX_ERROR_MESSAGES, type SynaxErrorMessages } from '@synax/client';

/** The refusals the account pages have their own customer copy for. */
const ACCOUNT_ERROR_CODES = [
  'APPOINTMENT_CHANGE_WINDOW_CLOSED',
  'APPOINTMENT_INVALID_TRANSITION',
  'APPOINTMENT_NOT_EDITABLE',
  'APPOINTMENT_NOT_FOUND',
  'CANCELLATION_INVALID_REASON',
  'REVIEW_INVALID_RATING',
  'REVIEW_INVALID_COMMENT',
  'REVIEW_NOT_REVIEWABLE',
  'REVIEW_WINDOW_CLOSED',
  'REVIEW_ALREADY_EXISTS',
  'REVIEW_NOT_FOUND',
  'USER_INVALID_NAME',
  'USER_INVALID_PHONE',
] as const;

/**
 * The account's own copy for the codes it knows, over whatever the app registered. Anything
 * else falls back to one generic sentence: a server description is English and not the
 * customer's voice.
 */
export function accountErrorMessages(): SynaxErrorMessages {
  const transloco = inject(TranslocoService);
  const parent = inject(SYNAX_ERROR_MESSAGES, { optional: true, skipSelf: true }) ?? {};
  const codes = Object.fromEntries(
    ACCOUNT_ERROR_CODES.map((code) => [code, () => transloco.translate(`account.errors.${code}`)]),
  );
  return {
    ...parent,
    codes: { ...parent.codes, ...codes },
    fallback: parent.fallback ?? (() => transloco.translate('account.errors.generic')),
  };
}
