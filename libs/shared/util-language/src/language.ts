/**
 * The language vocabulary, with no Angular in it.
 *
 * It stays dependency-free because the Express server in `server.ts` negotiates `/` before
 * Angular starts, and the sitemap generator runs outside the injector. Both need the same
 * language list and the same path arithmetic as the app, and a second copy of either drifts.
 */

/** Every language the site publishes an address for. Order is the fallback order. */
export const APP_LANGUAGES = ['el', 'en'] as const;

export type AppLanguage = (typeof APP_LANGUAGES)[number];

/** The product is Greek first. An unresolvable request becomes Greek, never English. */
export const DEFAULT_APP_LANGUAGE: AppLanguage = 'el';

export function isAppLanguage(value: unknown): value is AppLanguage {
  return typeof value === 'string' && (APP_LANGUAGES as readonly string[]).includes(value);
}

/**
 * Narrows a BCP 47 tag to one of ours by its primary subtag, so `el-GR` and `EL` both mean
 * Greek. It returns `null` and not the default, because a caller must tell no answer apart
 * from an answer that happens to be Greek.
 */
export function toAppLanguage(tag: string | null | undefined): AppLanguage | null {
  if (tag === null || tag === undefined) return null;

  const primary = tag.trim().split('-', 1)[0]?.toLowerCase();
  return isAppLanguage(primary) ? primary : null;
}

/** Reads the language a path is published under. `/el/barbershops` gives `el`. */
export function languageFromPath(path: string): AppLanguage | null {
  const segment = path.split('/', 3)[1];
  return isAppLanguage(segment) ? segment : null;
}

/** Prefixes a language-free path. `('/barbershops', 'en')` gives `/en/barbershops`. */
export function withLanguagePrefix(path: string, language: AppLanguage): string {
  const rest = path.startsWith('/') ? path.slice(1) : path;
  return rest === '' ? `/${language}` : `/${language}/${rest}`;
}

/**
 * Rewrites a published address into another language.
 *
 * Both languages share one set of English slugs, which makes this a segment swap and not a
 * lookup table. The switcher and the `hreflang` alternates rest on the same property. A path
 * with no language prefix gets a prefix instead of a rewrite.
 */
export function swapLanguageInPath(path: string, language: AppLanguage): string {
  const current = languageFromPath(path);
  if (current === null) return withLanguagePrefix(path, language);

  const rest = path.slice(`/${current}`.length);
  return rest === '' || rest === '/' ? `/${language}` : `/${language}${rest}`;
}
