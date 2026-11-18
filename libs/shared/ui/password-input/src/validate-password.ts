import {
  validate,
  type PathKind,
  type SchemaPath,
  type SchemaPathRules,
  type ValidationError,
} from '@angular/forms/signals';
import { DEFAULT_PASSWORD_RULES } from './password-rules';
import { PasswordRule } from './password-input.types';

/**
 * Signal Forms validation for a password field, driven by the same `PasswordRule[]` the
 * control renders as its checklist. Empty values are ignored, so pair it with `required()`
 * when the field is mandatory.
 *
 * ```ts
 * const signUpForm = form(model, (signUp) => {
 *   required(signUp.password);
 *   validatePassword(signUp.password);
 * });
 * ```
 * ```html
 * <lib-password-input [formField]="signUpForm.password" feedback="popover" />
 * ```
 *
 * Emits one error per unmet rule, kinded `password.<ruleKey>`, which the control
 * translates through `passwordInput.errors.*`.
 */
export function validatePassword<TPathKind extends PathKind = PathKind.Root>(
  path: SchemaPath<string, SchemaPathRules.Supported, TPathKind>,
  rules: readonly PasswordRule[] = DEFAULT_PASSWORD_RULES,
): void {
  validate(path, ({ value }) => {
    const password = value();
    if (!password) {
      return undefined;
    }

    const failures: ValidationError.WithoutFieldTree[] = rules
      .filter((rule) => !rule.test(password))
      .map((rule) => ({ kind: `password.${rule.key}` }));

    return failures.length > 0 ? failures : undefined;
  });
}
