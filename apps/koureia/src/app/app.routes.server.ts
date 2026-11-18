import { PrerenderFallback, RenderMode, ServerRoute } from '@angular/ssr';
import { APP_LANGUAGES } from '@util/language';

import { LANGUAGE_FREE_PAGE_PATHS } from './language-free-pages';
import { PRERENDERED_PAGE_PATHS, SERVER_RENDERED_PAGE_PATHS } from './public-pages';

/**
 * Both languages of every baked public page, prerendered: two files per path, because the
 * language is a path segment. Every cache that keys on the path separates them with no
 * configuration.
 *
 * CAUTION: The path must stay `:lang`. Angular matches this manifest against the route table,
 * where the language is the `:lang` parameter, so literal addresses prerender nothing.
 *
 * CAUTION: Keep `fallback: None`. A parameterized server route matches any first segment, so
 * `/foo` matches, misses the prerendered set, and under the default `Server` fallback returns a
 * 200. The body would even look right, because `canMatch` refuses `foo` and renders the 404 page.
 * Only the status lies, which is the soft 404 this arrangement exists to avoid.
 */
const prerenderedPages: ServerRoute[] = PRERENDERED_PAGE_PATHS.map((page) => ({
  path: page === '' ? ':lang' : `:lang/${page}`,
  renderMode: RenderMode.Prerender,
  fallback: PrerenderFallback.None,
  getPrerenderParams: () => Promise.resolve(APP_LANGUAGES.map((lang) => ({ lang }))),
}));

/**
 * The public pages that read the API, rendered per request so the answer is in the HTML a
 * crawler receives. See `SERVER_RENDERED_PAGE_PATHS` for what qualifies.
 *
 * The response is public and identical for every visitor of one language, so it is cacheable —
 * but `max-age=0` keeps it out of the browser's own store, where a person would keep seeing a
 * list that moved on. A shared cache holds it for a minute and may serve it stale for five more
 * while it revalidates.
 */
const serverRenderedPages: ServerRoute[] = SERVER_RENDERED_PAGE_PATHS.map((page) => ({
  path: page === '' ? ':lang' : `:lang/${page}`,
  renderMode: RenderMode.Server,
  headers: { 'Cache-Control': 'public, max-age=0, s-maxage=60, stale-while-revalidate=300' },
}));

export const serverRoutes: ServerRoute[] = [
  // Express answers `/` per visitor, so it cannot be cached. This entry covers the dev server,
  // which reaches Angular anyway.
  {
    path: '',
    renderMode: RenderMode.Server,
    headers: { 'Cache-Control': 'no-store' },
  },
  ...prerenderedPages,
  ...serverRenderedPages,
  // One barbershop's home page. Rendered per request and cached like the list, for the same
  // reasons. An unknown slug still reaches this entry: the page itself sets the 404 status and
  // `no-store`, through `RESPONSE_INIT`.
  {
    path: ':lang/barbershops/:slug',
    renderMode: RenderMode.Server,
    headers: { 'Cache-Control': 'public, max-age=0, s-maxage=60, stale-while-revalidate=300' },
  },
  // A step in a booking, never a landing page, so it is kept out of every index.
  {
    path: ':lang/barbershops/:slug/booking',
    renderMode: RenderMode.Server,
    headers: { 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex' },
  },
  // An account page, so it is not in `PUBLIC_PAGE_PATHS`. It still needs an entry of its own:
  // without one the wildcard below answers it, and a real page would come back with a 404 status.
  {
    path: ':lang/verify-email',
    renderMode: RenderMode.Server,
    headers: { 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex' },
  },
  // The unsubscribe page of the reminder emails. Rendered in the browser: opening it only reads
  // the token, and a crawler must not index a page that carries one.
  {
    path: ':lang/reminders/**',
    renderMode: RenderMode.Client,
    headers: { 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex' },
  },
  // The customer's own account. One `/**` entry covers `account` itself and every page under it.
  // Without it the wildcard below answers these addresses and a real page returns a 404.
  //
  // Rendered in the browser. Every page is the person's own data, read with a bearer token that
  // the transfer cache never carries, so a server render would be fetched again after hydration
  // and flash a loading state over the HTML it had just sent. Nobody indexes these pages either.
  {
    path: ':lang/account/**',
    renderMode: RenderMode.Client,
    headers: { 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex' },
  },
  // The barber's workspace: signed-in only, personal, and published with no language segment.
  // One `/**` entry covers `/management` itself as well as every page under it — the route tree
  // falls back to `**` when a segment run ends on a node that carries no metadata of its own.
  // Without it the wildcard below answers these addresses and a real page returns a 404.
  //
  // Rendered in the browser, unlike everything else here. The workspace is indexed by nobody and
  // its shell reads per-person state that only the browser holds — the collapsed sidebar rail in
  // `localStorage`. A server render cannot know any of it, so it would paint the default and let
  // the real state correct it a moment later, which is a visible jump on every load. There is no
  // first-paint speed to protect either: the pages behind the shell fetch their data client-side
  // regardless.
  ...LANGUAGE_FREE_PAGE_PATHS.map((page) => ({
    path: `${page}/**`,
    renderMode: RenderMode.Client as const,
    headers: { 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex' },
  })),
  // A new public page belongs in `PUBLIC_PAGE_PATHS`, which also puts it in the sitemap. Anything
  // else is unpublished: rendered so the 404 page is translated, and answered with the status a
  // crawler must see. A dynamic page, such as a barbershop's, needs its own entry above.
  {
    path: '**',
    renderMode: RenderMode.Server,
    status: 404,
    headers: { 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex' },
  },
];
