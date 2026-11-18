import {
  PasswordRule,
  PasswordStrengthScore,
  PasswordStrengthScorer,
} from './password-input.types';

/** Ratings above "empty": very weak, weak, fair, good, strong. */
export const PASSWORD_STRENGTH_LEVELS = 5;

/**
 * Rates a password against the same rules the checklist shows, so the
 * meter and the checklist can never contradict each other:
 *
 * - empty value → `0`
 * - otherwise the satisfied ratio mapped onto the five levels
 * - capped at `4` until **every** rule passes, so "strong" always means
 *   a complete checklist
 *
 * With the default five rules this lands one level per satisfied rule.
 * Fewer rules simply take bigger steps up the same scale — three rules
 * rate weak, good, strong — so the wording and colour stay comparable
 * across forms however many requirements a form sets.
 *
 * Swap it out with `<lib-password-input [strengthScorer]>` when you want
 * an entropy- or dictionary-based rating instead.
 */
export const defaultPasswordStrength: PasswordStrengthScorer = (
  value: string,
  rules: readonly PasswordRule[],
): PasswordStrengthScore => {
  if (!value) {
    return 0;
  }
  if (rules.length === 0) {
    return PASSWORD_STRENGTH_LEVELS;
  }

  const satisfied = rules.filter((rule) => rule.test(value)).length;
  const complete = satisfied === rules.length;
  const scaled = Math.ceil((satisfied / rules.length) * PASSWORD_STRENGTH_LEVELS);
  const score = Math.min(
    Math.max(scaled, 1),
    complete ? PASSWORD_STRENGTH_LEVELS : PASSWORD_STRENGTH_LEVELS - 1,
  );

  return score as PasswordStrengthScore;
};
