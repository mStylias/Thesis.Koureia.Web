/**
 * The addresses this app publishes with no `:lang` segment.
 *
 * Two readers, and they must agree: the Express rewrite, which prefixes a language onto any
 * first segment that is not one, and the server route manifest, which keeps these off the 404
 * wildcard. Miss either and `/management` becomes `/el/management` before Angular sees it.
 *
 * CAUTION: A page listed here has no language in its URL, so `activateLanguage` never runs for
 * it. `activateBrowserLanguage` answers instead, from the mirror cookie the account writes. A
 * page listed here must carry that resolver, or Transloco keeps whatever language is already
 * active — the default on a cold load.
 */
export const LANGUAGE_FREE_PAGE_PATHS = ['management'] as const;

export type LanguageFreePagePath = (typeof LANGUAGE_FREE_PAGE_PATHS)[number];

/** Whether a request path belongs to a language-free page, itself or any address below it. */
export function isLanguageFreePath(path: string): boolean {
  const segment = path.split('/', 2)[1];
  return (LANGUAGE_FREE_PAGE_PATHS as readonly string[]).includes(segment);
}
