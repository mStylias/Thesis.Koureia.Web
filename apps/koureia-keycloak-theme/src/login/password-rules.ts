import { passwordRules, type PasswordRule } from '@ui/password-input';
import type { KcContext } from './KcContext';

type RegisterContext = Extract<KcContext, { pageId: 'register.ftl' }>;
type PasswordPolicies = RegisterContext['passwordPolicies'];

/**
 * The realm password policy, for the pages Keycloak does not tell.
 *
 * Registration receives `passwordPolicies` and is always right. `login-update-password.ftl`
 * receives nothing, so it must either show no requirements or these.
 *
 * CAUTION: Change this with the realm. The original is the `passwordPolicy` field of the
 * `koureia` realm in `Aptison.Booking`, which nothing here can read. `update-password.ts` also
 * blocks a submit on these values, so a stale copy refuses a password the realm accepts.
 * `password-rules.spec.ts` pins them to force a deliberate edit.
 */
export const REQUIRED_POLICY: NonNullable<PasswordPolicies> = {
  length: 6,
  upperCase: 1,
  digits: 1,
};

/** Requirements for the shared password control, in the order Keycloak lists them. */
export function createPasswordRules(policies: PasswordPolicies): readonly PasswordRule[] {
  const effective = policies ?? REQUIRED_POLICY;

  return passwordRules({
    minLength: effective.length ?? 0,
    uppercase: (effective.upperCase ?? 0) > 0,
    lowercase: (effective.lowerCase ?? 0) > 0,
    digit: (effective.digits ?? 0) > 0,
    special: (effective.specialChars ?? 0) > 0,
  });
}
