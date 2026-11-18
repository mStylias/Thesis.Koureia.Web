import { NextFunction, Request, RequestHandler, Response } from 'express';
import type { CompanySitemapEntryResponse } from '@features/barbershops';
import {
  APP_LANGUAGES,
  AppLanguage,
  DEFAULT_APP_LANGUAGE,
  languageFromPath,
  toAppLanguage,
} from '@util/language';

import { isLanguageFreePath } from './app/language-free-pages';
import { PUBLIC_PAGE_PATHS } from './app/public-pages';
import {
  LANGUAGE_COOKIE,
  clearLanguageCookieHeader,
  clearUiLanguageCookieHeader,
  readLanguageCookie,
} from './language-cookie';
import { SITE_ORIGIN } from './app/site-origin';

export {
  LANGUAGE_COOKIE,
  clearLanguageCookieHeader,
  clearUiLanguageCookieHeader,
  readLanguageCookie,
};

export interface RootNegotiationDependencies {
  /** The stored preference of a signed-in visitor, read from the sealed session cookie. */
  readonly sessionLanguage: (request: Request) => string | null;
}

/**
 * The one precedence order, wherever a language is chosen for somebody. The session `loc` wins,
 * then the explicit-choice cookie, then Greek.
 *
 * Greek is not a fallback here, it is the answer. `Accept-Language` is deliberately not read:
 * the site is Greek until a person says otherwise, and a device setting is not that person
 * saying anything. English is reached through the switcher and through an account, both of
 * which are statements, and both of which land in one of the two sources above.
 */
function chooseLanguage(
  request: Request,
  sessionLanguage: (request: Request) => string | null,
): AppLanguage {
  return (
    toAppLanguage(sessionLanguage(request)) ??
    readLanguageCookie(request.headers.cookie) ??
    DEFAULT_APP_LANGUAGE
  );
}

/**
 * Answers `/` by choosing a language and redirecting to it. See {@link chooseLanguage} for the
 * order. This is the one address with no language in it, and the only per-visitor decision.
 *
 * Express and not Angular, because the winning source is the sealed session cookie, which is
 * `HttpOnly` and unreadable in the browser. A client-side decision also flashes the wrong
 * language on every first load.
 *
 * CAUTION: Keep `no-store` and the 302. A cached root hands the first visitor's language to
 * everybody after them, and a browser that caches a 301 never asks again after a sign-in or a
 * switch.
 */
export function createRootNegotiation(dependencies: RootNegotiationDependencies): RequestHandler {
  return (request, response) => {
    const language = chooseLanguage(request, dependencies.sessionLanguage);

    response.setHeader('Cache-Control', 'no-store');
    response.redirect(302, `/${language}${request.url.slice(1)}`);
  };
}

/**
 * Prefixes a language when the first segment is not one, so an unpublished address renders the
 * localized 404 at the address that was requested.
 *
 * A rewrite, not a redirect: a redirected 404 makes a crawler follow a hop to reach a refusal and
 * indexes an address that only ever redirects. `/foo` answers 404 as `/foo`.
 *
 * The pages in `LANGUAGE_FREE_PAGE_PATHS` are exempt: their address has no language segment on
 * purpose, and prefixing one turns `/management` into an unpublished `/el/management`.
 *
 * CAUTION: Run this after the static handler, or it rewrites a real asset such as
 * `/brand/koureia_icon.png` out from under itself. Set both `url` and `originalUrl`, because
 * `@angular/ssr` builds the render URL from `originalUrl ?? url` and ignores a lone `url`.
 */
export function createUnknownLanguageRewrite(
  dependencies: RootNegotiationDependencies,
): RequestHandler {
  return (request, _response, next) => {
    if (languageFromPath(request.path) === null && !isLanguageFreePath(request.path)) {
      const language = chooseLanguage(request, dependencies.sessionLanguage);
      request.url = `/${language}${request.url}`;
      request.originalUrl = `/${language}${request.originalUrl}`;
    }

    next();
  };
}

/**
 * The addresses this site published before the language went into the path.
 *
 * A 301, because the old address is gone and its ranking must transfer instead of splitting. To
 * Greek and not to a negotiated language, because a permanent redirect that varies by visitor is
 * one a browser cached wrongly. These must exist from the first deploy.
 */
export function redirectLegacyPaths(
  request: Request,
  response: Response,
  next: NextFunction,
): void {
  const path = request.path.replace(/\/$/, '');
  if (!LEGACY_PATHS.has(path)) {
    next();
    return;
  }

  const query = request.originalUrl.slice(request.path.length);
  response.redirect(301, `/${DEFAULT_APP_LANGUAGE}${path}${query}`);
}

const LEGACY_PATHS = new Set(
  PUBLIC_PAGE_PATHS.filter((page) => page !== '').map((page) => `/${page}`),
);

/**
 * `sitemap.xml`, with both languages of every page and `xhtml:link` alternates.
 *
 * Generated, not hand-written, because it must grow with the barbershop pages, and a hand-written
 * one stops matching the site. The alternates repeat the reciprocity `PageMetadata` puts in the
 * pages. A crawler reads both, so one alone does half the work.
 *
 * `shops` adds one home page per barbershop. An entry whose slug is not a well-formed slug is
 * dropped, because the slug is written into the XML unescaped.
 */
export function renderSitemap(shops: readonly CompanySitemapEntryResponse[] = []): string {
  const shopPages = shops.filter((shop) => SLUG_PATTERN.test(shop.slug));
  const urls = APP_LANGUAGES.flatMap((language) => [
    ...PUBLIC_PAGE_PATHS.map((page) => renderSitemapEntry(language, page)),
    ...shopPages.map((shop) =>
      renderSitemapEntry(language, `barbershops/${shop.slug}`, toLastModified(shop.lastModified)),
    ),
  ]);

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"',
    '        xmlns:xhtml="http://www.w3.org/1999/xhtml">',
    ...urls,
    '</urlset>',
    '',
  ].join('\n');
}

/** The slug format the API guarantees. Anything else is not written into the sitemap. */
const SLUG_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/;

/** A `<lastmod>` value, or `null` when the API sent something that is not a date. */
function toLastModified(value: string): string | null {
  const time = Date.parse(value);
  return Number.isNaN(time) ? null : new Date(time).toISOString();
}

function renderSitemapEntry(
  language: AppLanguage,
  page: string,
  lastModified: string | null = null,
): string {
  const alternates = [
    ...APP_LANGUAGES.map(
      (other) =>
        `    <xhtml:link rel="alternate" hreflang="${other}" href="${absolute(other, page)}"/>`,
    ),
    `    <xhtml:link rel="alternate" hreflang="x-default" href="${SITE_ORIGIN}/"/>`,
  ];

  return [
    '  <url>',
    `    <loc>${absolute(language, page)}</loc>`,
    ...(lastModified === null ? [] : [`    <lastmod>${lastModified}</lastmod>`]),
    ...alternates,
    '  </url>',
  ].join('\n');
}

function absolute(language: AppLanguage, page: string): string {
  return page === '' ? `${SITE_ORIGIN}/${language}` : `${SITE_ORIGIN}/${language}/${page}`;
}

/**
 * Names the sitemap so a crawler finds it, and keeps the BFF and the account pages out of the
 * index. `PageMetadata` and the `**` server route make the same refusal.
 */
export function renderRobots(): string {
  return ['User-agent: *', 'Disallow: /auth/', '', `Sitemap: ${SITE_ORIGIN}/sitemap.xml`, ''].join(
    '\n',
  );
}
