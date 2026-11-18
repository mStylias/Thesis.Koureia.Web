import { AppLanguage, withLanguagePrefix } from '@util/language';

/**
 * The destination to leave verification for.
 *
 * The value arrives in the query string, so it is attacker-controllable and gets the same
 * treatment the BFF gives its own `returnUrl`: a path on this origin, never a URL. A protocol-
 * relative `//host` reads as same-origin to a naive check and is not, and a backslash is a path
 * separator to some parsers and not to others — both are refused rather than repaired.
 *
 * Anything unusable falls back to the language home.
 */
export function safeReturnUrl(value: unknown, language: AppLanguage): string {
  const home = withLanguagePrefix('/', language);
  if (typeof value !== 'string' || !value.startsWith('/') || value.startsWith('//')) return home;
  if (value.includes('\\') || value.includes('\0')) return home;
  return value;
}
