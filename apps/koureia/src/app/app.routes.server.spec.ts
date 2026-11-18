import { PrerenderFallback, RenderMode, ServerRoute } from '@angular/ssr';

import { serverRoutes } from './app.routes.server';
import { LANGUAGE_FREE_PAGE_PATHS } from './language-free-pages';
import { PRERENDERED_PAGE_PATHS, SERVER_RENDERED_PAGE_PATHS } from './public-pages';

function find(path: string): ServerRoute | undefined {
  return serverRoutes.find((route) => route.path === path);
}

describe('server routes', () => {
  it('server-renders the negotiating root without caching it', () => {
    // A cached root would hand the first visitor's language to everyone after them.
    expect(find('')).toMatchObject({
      renderMode: RenderMode.Server,
      headers: { 'Cache-Control': 'no-store' },
    });
  });

  it.each(PRERENDERED_PAGE_PATHS)('prerenders the public "%s" page under a language', (page) => {
    expect(find(page === '' ? ':lang' : `:lang/${page}`)).toMatchObject({
      renderMode: RenderMode.Prerender,
    });
  });

  it.each(SERVER_RENDERED_PAGE_PATHS)(
    'renders the API-backed "%s" page per request, cacheable but not by the browser',
    (page) => {
      // A build cannot bake this page, so prerendering it would publish an empty shell. The
      // shared cache may hold the render; the browser may not, or a person keeps a stale list.
      expect(find(page === '' ? ':lang' : `:lang/${page}`)).toMatchObject({
        renderMode: RenderMode.Server,
        headers: { 'Cache-Control': 'public, max-age=0, s-maxage=60, stale-while-revalidate=300' },
      });
    },
  );

  it("renders a barbershop's home page per request, cacheable like the list", () => {
    expect(find(':lang/barbershops/:slug')).toMatchObject({
      renderMode: RenderMode.Server,
      headers: { 'Cache-Control': 'public, max-age=0, s-maxage=60, stale-while-revalidate=300' },
    });
  });

  it('keeps the booking page out of every cache and every index', () => {
    expect(find(':lang/barbershops/:slug/booking')).toMatchObject({
      renderMode: RenderMode.Server,
      headers: { 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex' },
    });
  });

  it('lists the barbershop pages above the 404 wildcard', () => {
    const wildcard = serverRoutes.findIndex((route) => route.path === '**');

    expect(
      serverRoutes.findIndex((route) => route.path === ':lang/barbershops/:slug'),
    ).toBeLessThan(wildcard);
    expect(
      serverRoutes.findIndex((route) => route.path === ':lang/barbershops/:slug/booking'),
    ).toBeLessThan(wildcard);
  });

  it('expands to both languages of every prerendered page, and nothing in between', async () => {
    const prerendered = serverRoutes.filter((route) => route.renderMode === RenderMode.Prerender);

    const paths = await Promise.all(
      prerendered.map(async (route) => {
        const params = 'getPrerenderParams' in route ? await route.getPrerenderParams() : [];
        return params.map((param) => route.path.replace(':lang', param['lang']));
      }),
    );

    expect(paths.flat().sort()).toEqual(['el', 'el/how-it-works', 'en', 'en/how-it-works']);
  });

  it('declines an unlisted language rather than soft-404ing it', () => {
    // `:lang` matches any first segment. Under the default `Server` fallback, `/foo` would
    // be rendered and returned with a 200 — the 404 page under a status saying it exists.
    for (const route of serverRoutes.filter((r) => r.renderMode === RenderMode.Prerender)) {
      expect(route).toMatchObject({ fallback: PrerenderFallback.None });
    }
  });

  it('does not send BFF auth endpoints to Angular', () => {
    expect(serverRoutes.some((route) => route.path.startsWith('auth/'))).toBe(false);
  });

  it.each(LANGUAGE_FREE_PAGE_PATHS)(
    'claims every address under the language-free "%s" page',
    (page) => {
      // One `/**` entry covers the page itself too: a segment run that ends on a node with no
      // metadata falls back to `**`. Without it the wildcard below returns 404 for a real page.
      //
      // Client, not Server: the shell renders from state only the browser holds, so a server
      // render would paint the default and jump when the real one arrives.
      expect(find(`${page}/**`)).toMatchObject({
        renderMode: RenderMode.Client,
        headers: { 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex' },
      });
    },
  );

  it('answers an address nobody published with a 404 a crawler will believe', () => {
    expect(find('**')).toMatchObject({
      renderMode: RenderMode.Server,
      status: 404,
      headers: { 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex' },
    });
  });
});
