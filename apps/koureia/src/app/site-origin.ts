/**
 * The origin every published address is written against.
 *
 * CAUTION: Keep this a constant. The public pages prerender at build time, so a `canonical` or an
 * `hreflang` is baked in and must name the address the page will be served at. A value read from
 * the request puts `localhost` in a shipped file.
 *
 * `canonical-host.ts` redirects the `www` host here: one origin, one address per page.
 */
export const SITE_ORIGIN = 'https://koureia.gr';
