/** Control size, aligned with the Text input and Button sizes. */
export type PasswordInputSize = 'sm' | 'md' | 'lg';

/**
 * Where the strength meter and requirements checklist render.
 *
 * - `none` — no feedback (the default; a plain masked field).
 * - `inline` — in normal flow under the field, so it pushes layout.
 * - `popover` — floating in a CDK overlay under the field while it has focus.
 * - `side` — floating beside the field, top-aligned, so the panel covers
 *   neither the field nor the controls under it. It falls back to the
 *   `popover` placement when the viewport is too narrow.
 */
export type PasswordFeedback = 'none' | 'inline' | 'popover' | 'side';

/**
 * The edge a floating feedback panel landed on after viewport flips.
 * `block` is the stacked placement, above or below the field.
 */
export type PasswordPanelPlacement = 'start' | 'end' | 'block';

/**
 * Qualitative strength rating on a five-point scale — very weak, weak,
 * fair, good, strong. `0` means the field is empty.
 */
export type PasswordStrengthScore = 0 | 1 | 2 | 3 | 4 | 5;

/**
 * `autocomplete` for the inner input. Use `new-password` on sign-up and
 * reset forms so password managers offer to generate one instead of
 * filling the saved credential.
 */
export type PasswordAutocomplete = 'current-password' | 'new-password' | 'off';

/**
 * One requirement a password has to satisfy. The same array drives the
 * checklist, the strength score and — through `validatePassword` — the
 * form's validity, so the three can never disagree.
 */
export interface PasswordRule {
  /**
   * Stable identifier. Doubles as the i18n key under
   * `passwordInput.rules` and as the error kind suffix
   * (`password.<key>`), so keep it in sync with `i18n/*.ts` when adding
   * custom rules.
   */
  readonly key: string;

  /** Whether `value` satisfies this requirement. */
  readonly test: (value: string) => boolean;

  /** Interpolation params for the translated label, e.g. `{ min: 12 }`. */
  readonly params?: Record<string, string | number>;

  /** Ready-made label, used instead of looking the `key` up in i18n. */
  readonly label?: string;
}

/** Options for the `passwordRules` factory. All rules default to on. */
export interface PasswordRuleOptions {
  /** Minimum character count. `0` drops the length rule. Defaults to 12. */
  readonly minLength?: number;
  readonly uppercase?: boolean;
  readonly lowercase?: boolean;
  readonly digit?: boolean;
  readonly special?: boolean;
}

/** Turns a value and its rules into a 0–4 rating. */
export type PasswordStrengthScorer = (
  value: string,
  rules: readonly PasswordRule[],
) => PasswordStrengthScore;

/** A rule paired with whether the current value satisfies it. */
export interface PasswordRuleState {
  readonly rule: PasswordRule;
  readonly label: string;
  readonly met: boolean;
}
