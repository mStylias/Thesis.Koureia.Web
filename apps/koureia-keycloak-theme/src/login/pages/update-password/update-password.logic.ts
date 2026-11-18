import type { PasswordRule } from '@ui/password-input';

/**
 * The names Keycloak attributes a password error to. It reports a rejected password against
 * `password` and a mismatch against `password-confirm`, and neither matches the `password-new`
 * input. One field on screen, so both belong to it.
 */
export const PASSWORD_ERROR_FIELDS = ['password', 'password-confirm'] as const;

/**
 * Whether the account console sent the visitor here, rather than a reset link.
 *
 * Keycloak sets `isAppInitiatedAction` only then, and only then does a previous page exist. A
 * cancel control after a reset link would offer an exit that is not there.
 */
export function canCancel(isAppInitiatedAction: boolean | undefined): boolean {
  return isAppInitiatedAction === true;
}

/** Whether the password satisfies every requirement shown by the field. */
export function meetsPasswordRules(password: string, rules: readonly PasswordRule[]): boolean {
  return rules.every((rule) => rule.test(password));
}
