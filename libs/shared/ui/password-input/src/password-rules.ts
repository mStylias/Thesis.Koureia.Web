import { PasswordRule, PasswordRuleOptions } from './password-input.types';

/** Default minimum length, in line with NIST SP 800-63B guidance. */
export const DEFAULT_PASSWORD_MIN_LENGTH = 12;

// Unicode-aware so Greek passwords behave like Latin ones: `\p{Lu}` and
// `\p{Ll}` match ΚΕΦΑΛΑΙΑ and πεζά, not just A-Z / a-z.
const UPPERCASE = /\p{Lu}/u;
const LOWERCASE = /\p{Ll}/u;
const DIGIT = /\p{Nd}/u;
// Anything that is neither a letter, a number, nor whitespace. Spaces
// are allowed in passwords but do not count as a special character.
const SPECIAL = /[^\p{L}\p{N}\s]/u;

/** Built once: constructing a segmenter per keystroke would be wasteful. */
const graphemes = new Intl.Segmenter(undefined, { granularity: 'grapheme' });

/**
 * Character count as a reader would make it: by grapheme cluster, so an
 * emoji or an accented pair counts once instead of the two or more UTF-16
 * units `String.length` reports.
 */
function characterCount(value: string): number {
  // `segment()` returns an iterable, not an array — count it by hand
  // rather than materializing one string per character on every keystroke.
  let count = 0;
  for (const segment of graphemes.segment(value)) {
    void segment;
    count++;
  }
  return count;
}

/** Rejects fractional and negative lengths (`12.5` → `12`, `-1` → `0`). */
function normalizeMinLength(minLength: number): number {
  return Number.isFinite(minLength) ? Math.max(0, Math.floor(minLength)) : 0;
}

/**
 * Builds a rule set. Every rule is on by default; pass `false` to drop
 * one, or `minLength: 0` to drop the length requirement.
 *
 * ```ts
 * const RULES = passwordRules({ minLength: 10, special: false });
 * ```
 *
 * Feed the same array to `<lib-password-input [rules]>` and to
 * `validatePassword` in the schema so the checklist, the strength meter
 * and the form's validity stay in agreement.
 */
export function passwordRules(options: PasswordRuleOptions = {}): readonly PasswordRule[] {
  const {
    minLength = DEFAULT_PASSWORD_MIN_LENGTH,
    uppercase = true,
    lowercase = true,
    digit = true,
    special = true,
  } = options;

  const min = normalizeMinLength(minLength);
  const rules: PasswordRule[] = [];

  if (min > 0) {
    rules.push({
      key: 'minLength',
      params: { min },
      test: (value) => characterCount(value) >= min,
    });
  }
  if (uppercase) {
    rules.push({ key: 'uppercase', test: (value) => UPPERCASE.test(value) });
  }
  if (lowercase) {
    rules.push({ key: 'lowercase', test: (value) => LOWERCASE.test(value) });
  }
  if (digit) {
    rules.push({ key: 'digit', test: (value) => DIGIT.test(value) });
  }
  if (special) {
    rules.push({ key: 'special', test: (value) => SPECIAL.test(value) });
  }

  return rules;
}

/**
 * At least 12 characters, with an uppercase letter, a lowercase letter,
 * a number and a symbol. The default for both `lib-password-input` and
 * `validatePassword`.
 */
export const DEFAULT_PASSWORD_RULES: readonly PasswordRule[] = passwordRules();
