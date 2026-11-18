import { NextFunction, Request, Response } from 'express';

import {
  LANGUAGE_COOKIE,
  clearLanguageCookieHeader,
  createRootNegotiation,
  createUnknownLanguageRewrite,
  readLanguageCookie,
  redirectLegacyPaths,
  renderRobots,
  renderSitemap,
} from './language-routes';

interface Redirect {
  readonly status: number;
  readonly location: string;
}

function fakeResponse(): Response & { redirects: Redirect[]; headers: Record<string, string> } {
  const redirects: Redirect[] = [];
  const headers: Record<string, string> = {};

  return {
    redirects,
    headers,
    setHeader(name: string, value: string) {
      headers[name.toLowerCase()] = value;
    },
    redirect(status: number, location: string) {
      redirects.push({ status, location });
    },
  } as unknown as Response & { redirects: Redirect[]; headers: Record<string, string> };
}

function negotiate(
  options: {
    readonly cookie?: string;
    readonly acceptLanguage?: string;
    readonly sessionLanguage?: string | null;
    readonly url?: string;
  } = {},
): { redirect: Redirect | undefined; headers: Record<string, string> } {
  const handler = createRootNegotiation({
    sessionLanguage: () => options.sessionLanguage ?? null,
  });
  const response = fakeResponse();
  const request = {
    url: options.url ?? '/',
    headers: { cookie: options.cookie, 'accept-language': options.acceptLanguage },
  } as unknown as Request;

  handler(request, response, (() => undefined) as NextFunction);
  return { redirect: response.redirects[0], headers: response.headers };
}

describe('root negotiation', () => {
  it('prefers the stored preference of a signed-in visitor', () => {
    expect(negotiate({ sessionLanguage: 'en' }).redirect).toEqual({
      status: 302,
      location: '/en',
    });
  });

  it('accepts a region subtag in the session claim', () => {
    expect(negotiate({ sessionLanguage: 'el-GR' }).redirect?.location).toBe('/el');
  });

  it('prefers an explicit choice, but not over a session', () => {
    expect(negotiate({ cookie: `${LANGUAGE_COOKIE}=en` }).redirect?.location).toBe('/en');
    expect(
      negotiate({ sessionLanguage: 'el', cookie: `${LANGUAGE_COOKIE}=en` }).redirect?.location,
    ).toBe('/el');
  });

  it('is Greek for an English browser that has said nothing', () => {
    expect(negotiate({ acceptLanguage: 'en-GB,en;q=0.9' }).redirect?.location).toBe('/el');
  });

  it('is Greek with no cookie, no session and no header at all', () => {
    expect(negotiate().redirect?.location).toBe('/el');
  });

  it('ignores a cookie holding a language we do not publish', () => {
    expect(negotiate({ cookie: `${LANGUAGE_COOKIE}=de` }).redirect?.location).toBe('/el');
  });

  it('carries the query string through the redirect', () => {
    expect(negotiate({ url: '/?utm_source=x' }).redirect?.location).toBe('/el?utm_source=x');
  });

  it('never caches: a cached root serves the first visitor language to everyone', () => {
    expect(negotiate().headers['cache-control']).toBe('no-store');
  });

  it('is a 302, because the answer changes when someone signs in or switches', () => {
    expect(negotiate().redirect?.status).toBe(302);
  });
});

describe('unknown-language rewrite', () => {
  function rewrite(
    url: string,
    headers: Record<string, string | undefined> = {},
    sessionLanguage: string | null = null,
  ): { url: string; originalUrl: string; passedThrough: boolean } {
    const handler = createUnknownLanguageRewrite({ sessionLanguage: () => sessionLanguage });
    const request = {
      url,
      originalUrl: url,
      path: url.split(/[?#]/, 1)[0],
      headers,
    } as unknown as Request;

    let passedThrough = false;
    handler(request, fakeResponse(), (() => {
      passedThrough = true;
    }) as NextFunction);

    return { url: request.url, originalUrl: request.originalUrl, passedThrough };
  }

  it('gives an unpublished address a language so its 404 can be translated', () => {
    expect(rewrite('/foo').url).toBe('/el/foo');
  });

  it('rewrites originalUrl too — @angular/ssr renders from that, not from url', () => {
    expect(rewrite('/foo').originalUrl).toBe('/el/foo');
  });

  it('translates the refusal into the language the visitor chose', () => {
    expect(rewrite('/foo', { cookie: `${LANGUAGE_COOKIE}=en` }).url).toBe('/en/foo');
  });

  it('prefers a signed-in visitor stored preference, as everywhere else', () => {
    expect(rewrite('/foo', { cookie: `${LANGUAGE_COOKIE}=en` }, 'el').url).toBe('/el/foo');
  });

  it('stays Greek for an English browser, as everywhere else', () => {
    expect(rewrite('/foo', { 'accept-language': 'en-GB,en;q=0.9' }).url).toBe('/el/foo');
  });

  it.each(['/el/foo', '/en/barbershops', '/el'])('leaves %s alone', (url) => {
    expect(rewrite(url).url).toBe(url);
  });

  // A language-free page has no `:lang` segment on purpose. Prefixing one turns a real
  // address into an unpublished one, and the visitor gets a 404 for a page that exists.
  it.each(['/management', '/management/calendar', '/management/calendar?a=1'])(
    'leaves the language-free %s alone',
    (url) => {
      expect(rewrite(url).url).toBe(url);
    },
  );

  it('always continues down the stack — it rewrites, it never answers', () => {
    expect(rewrite('/foo').passedThrough).toBe(true);
    expect(rewrite('/el/foo').passedThrough).toBe(true);
  });

  it('keeps the query string on the rewritten address', () => {
    expect(rewrite('/foo?a=1').url).toBe('/el/foo?a=1');
  });
});

describe('readLanguageCookie', () => {
  it('reads the cookie from among others', () => {
    expect(readLanguageCookie(`ks-hint=1; ${LANGUAGE_COOKIE}=en; other=x`)).toBe('en');
  });

  it.each([[undefined], [''], ['other=x'], [`${LANGUAGE_COOKIE}=`], [`${LANGUAGE_COOKIE}=de`]])(
    'returns null for %s',
    (cookie) => {
      expect(readLanguageCookie(cookie)).toBeNull();
    },
  );
});

describe('clearLanguageCookieHeader', () => {
  it('expires the cookie so a shared tablet does not leak a language between people', () => {
    expect(clearLanguageCookieHeader(false)).toBe(
      `${LANGUAGE_COOKIE}=; Path=/; Max-Age=0; SameSite=Lax`,
    );
  });

  it('marks it Secure wherever the session cookie is', () => {
    expect(clearLanguageCookieHeader(true)).toContain('; Secure');
  });
});

describe('redirectLegacyPaths', () => {
  function visit(
    path: string,
    originalUrl = path,
  ): { redirect: Redirect | undefined; passedThrough: boolean } {
    const response = fakeResponse();
    let passedThrough = false;
    redirectLegacyPaths({ path, originalUrl } as unknown as Request, response, (() => {
      passedThrough = true;
    }) as NextFunction);
    return { redirect: response.redirects[0], passedThrough };
  }

  it.each(['/barbershops', '/how-it-works'])('permanently moves %s to the Greek page', (path) => {
    // A 301 and not a 302: the old address is gone, and its ranking should transfer
    // rather than be split between two addresses.
    expect(visit(path).redirect).toEqual({ status: 301, location: `/el${path}` });
  });

  it('tolerates a trailing slash', () => {
    expect(visit('/barbershops/').redirect?.location).toBe('/el/barbershops');
  });

  it('keeps the query string, so a campaign link still attributes', () => {
    expect(visit('/barbershops', '/barbershops?utm_source=x').redirect?.location).toBe(
      '/el/barbershops?utm_source=x',
    );
  });

  it.each(['/el/barbershops', '/en/barbershops', '/auth/callback', '/', '/foo'])(
    'leaves %s to the rest of the stack',
    (path) => {
      expect(visit(path).passedThrough).toBe(true);
    },
  );
});

describe('renderSitemap', () => {
  const sitemap = renderSitemap();

  it('lists both languages of every public page', () => {
    for (const path of [
      '/el',
      '/el/how-it-works',
      '/el/barbershops',
      '/en',
      '/en/how-it-works',
      '/en/barbershops',
    ]) {
      expect(sitemap).toContain(`<loc>https://koureia.gr${path}</loc>`);
    }
  });

  it('lists exactly six URLs — no more, so a stale entry cannot hide', () => {
    expect(sitemap.match(/<loc>/g)).toHaveLength(6);
  });

  it('gives each entry reciprocal xhtml:link alternates plus x-default', () => {
    expect(
      sitemap.match(/<xhtml:link rel="alternate" hreflang="el" href="https:\/\/koureia\.gr\/el"/g),
    ).toHaveLength(2);
    expect(sitemap.match(/hreflang="x-default"/g)).toHaveLength(6);
  });

  it('declares the xhtml namespace the alternates need to be valid', () => {
    expect(sitemap).toContain('xmlns:xhtml="http://www.w3.org/1999/xhtml"');
  });

  it('never lists an unprefixed or auth address', () => {
    expect(sitemap).not.toMatch(/<loc>https:\/\/koureia\.gr\/(barbershops|how-it-works|auth)/);
  });
});

describe('renderSitemap with barbershops', () => {
  const sitemap = renderSitemap([
    { slug: 'barber-house-kolonaki', lastModified: '2026-09-01T10:00:00Z' },
    { slug: 'the-razor', lastModified: 'not a date' },
    { slug: '../evil"<x>', lastModified: '2026-09-01T10:00:00Z' },
  ]);

  it("lists both languages of every barbershop's home page", () => {
    expect(sitemap).toContain('<loc>https://koureia.gr/el/barbershops/barber-house-kolonaki</loc>');
    expect(sitemap).toContain('<loc>https://koureia.gr/en/barbershops/barber-house-kolonaki</loc>');
    expect(sitemap).toContain('<loc>https://koureia.gr/en/barbershops/the-razor</loc>');
  });

  it('gives each barbershop reciprocal alternates', () => {
    expect(
      sitemap.match(
        /hreflang="en" href="https:\/\/koureia\.gr\/en\/barbershops\/barber-house-kolonaki"/g,
      ),
    ).toHaveLength(2);
  });

  it('dates an entry when the API sent a date, and only then', () => {
    expect(sitemap.match(/<lastmod>2026-09-01T10:00:00.000Z<\/lastmod>/g)).toHaveLength(2);
    expect(sitemap.match(/<lastmod>/g)).toHaveLength(2);
  });

  it('drops a slug that is not well formed, rather than writing it into the XML', () => {
    expect(sitemap).not.toContain('evil');
    // Three static pages and two shops, in each of two languages.
    expect(sitemap.match(/<loc>/g)).toHaveLength(10);
  });

  it('never lists a booking page', () => {
    expect(sitemap).not.toContain('/booking');
  });
});

describe('renderRobots', () => {
  it('names the sitemap, so it can be found without being submitted', () => {
    expect(renderRobots()).toContain('Sitemap: https://koureia.gr/sitemap.xml');
  });

  it('keeps the BFF out of the index', () => {
    expect(renderRobots()).toContain('Disallow: /auth/');
  });
});
