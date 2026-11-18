/**
 * Every public, indexable page, as a language-free path.
 *
 * One list with three readers: the prerender manifest, the sitemap, and the `hreflang`
 * alternates. Shared English slugs let one list serve both languages. Add a new marketing page
 * here and all three pick it up.
 */
export const PUBLIC_PAGE_PATHS = ['', 'how-it-works', 'barbershops'] as const;

export type PublicPagePath = (typeof PUBLIC_PAGE_PATHS)[number];

/**
 * The public pages a build cannot bake, rendered per request instead.
 *
 * A page belongs here when its content comes from the API: nothing serves the API during
 * `nx build`, so prerendering one writes a file with the shell and no data, and the crawler is
 * handed a page that says nothing. Everything else about such a page is unchanged — it stays in
 * {@link PUBLIC_PAGE_PATHS}, so it stays in the sitemap and in the `hreflang` set.
 *
 * CAUTION: `tools/seo/check-prerender.mjs` reads the built files and cannot import this. Its
 * own `PAGES` list must leave out whatever is listed here, or it fails on a file that was never
 * meant to exist.
 */
export const SERVER_RENDERED_PAGE_PATHS: readonly PublicPagePath[] = ['barbershops'];

/** The public pages the build writes to a file. {@link PUBLIC_PAGE_PATHS} minus the rest. */
export const PRERENDERED_PAGE_PATHS: readonly PublicPagePath[] = PUBLIC_PAGE_PATHS.filter(
  (page) => !SERVER_RENDERED_PAGE_PATHS.includes(page),
);
