import { DOCUMENT } from '@angular/common';
import { DestroyRef, Service, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Meta } from '@angular/platform-browser';
import { ActivatedRouteSnapshot, NavigationEnd, Router } from '@angular/router';
import { TranslocoService } from '@jsverse/transloco';
import { BRAND } from '@util/brand';
import {
  APP_LANGUAGES,
  AppLanguage,
  languageFromPath,
  readPageMeta,
  swapLanguageInPath,
} from '@util/language';
import { filter } from 'rxjs';

import { PUBLIC_PAGE_PATHS } from '../public-pages';
import { SITE_ORIGIN } from '../site-origin';

/** OG wants `language_TERRITORY`, a different vocabulary from the path prefix. */
const OPEN_GRAPH_LOCALES: Record<AppLanguage, string> = {
  el: 'el_GR',
  en: 'en_US',
};

/**
 * Writes the per-language, per-page head. Four signals, and a missing one undermines the rest:
 *
 * - **`<html lang>`.** An English page that claims to be Greek contradicts everything else. The
 *   static `index.html` carries `el`, and this overwrites it during the render.
 * - **A self-referencing `canonical`.** Without it the two languages read as duplicates and
 *   Google picks one.
 * - **Reciprocal `hreflang`.** Every language names every other, plus `x-default` for the root.
 *   Google ignores a non-reciprocal annotation silently, which is why the alternates come from
 *   one list here instead of one per page.
 * - **`description` and the OG tags,** per language and per page.
 *
 * Only public pages get `canonical` and `hreflang`. An unpublished address gets `noindex` and no
 * annotation, because a 404 that claims to be canonical is worse than one that claims nothing.
 *
 * A page built from data, such as a barbershop's home page, resolves a `PageMeta` instead. Its
 * literal title, description and image replace the translated keys, and its `indexable` flag
 * replaces the lookup in `PUBLIC_PAGE_PATHS`.
 *
 * NOTE: This runs on `NavigationEnd` and stays synchronous, so the tags reach the HTML the server
 * sends. `activateLanguage` has loaded the dictionary by then, so `transloco.translate` answers
 * without a wait.
 */
@Service()
export class PageMetadata {
  private readonly router = inject(Router);
  private readonly meta = inject(Meta);
  private readonly document = inject(DOCUMENT);
  private readonly transloco = inject(TranslocoService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly brandName = inject(BRAND).name;

  /** Called once from `provideAppInitializer`, before the first navigation resolves. */
  start(): void {
    this.router.events
      .pipe(
        filter((event): event is NavigationEnd => event instanceof NavigationEnd),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe(() => {
        this.apply();
      });
  }

  private apply(): void {
    const path = pathWithoutQuery(this.router.url);
    const language = languageFromPath(path) ?? (this.transloco.getActiveLang() as AppLanguage);
    const root = this.router.routerState.snapshot.root;
    const route = deepestRoute(root);
    const pageMeta = readPageMeta(root);

    this.document.documentElement.lang = language;

    const title = pageMeta?.title ?? this.translate(route.title);
    const description =
      pageMeta === null ? this.translate(readDescriptionKey(route)) : pageMeta.description;

    this.setOrRemove('description', description);
    this.setOrRemove('og:title', title === null ? this.brandName : `${title} | ${this.brandName}`);
    this.setOrRemove('og:description', description);
    this.setOrRemove('og:locale', OPEN_GRAPH_LOCALES[language]);
    this.setOrRemove(
      'og:locale:alternate',
      APP_LANGUAGES.filter((other) => other !== language)
        .map((other) => OPEN_GRAPH_LOCALES[other])
        .join(','),
    );
    this.setOrRemove('og:image', pageMeta?.image ?? null);

    if (pageMeta?.indexable ?? isPublicPage(path)) {
      this.setOrRemove('og:url', `${SITE_ORIGIN}${path}`);
      this.setOrRemove('robots', null);
      this.setCanonical(`${SITE_ORIGIN}${path}`);
      this.setAlternates(path);
      return;
    }

    // Reachable, useless in an index, and some will carry a company name in time. The `**`
    // server route sends `X-Robots-Tag` too. This covers a client-side navigation.
    this.setOrRemove('robots', 'noindex, follow');
    this.setOrRemove('og:url', null);
    this.setCanonical(null);
    this.setAlternates(null);
  }

  private translate(key: string | undefined): string | null {
    if (key === undefined || key === '') return null;

    const value = this.transloco.translate(key);
    // Transloco echoes the key back when a translation is missing, and `descriptions.home` as a
    // description is worse than none, because it looks deliberate.
    return typeof value === 'string' && value !== '' && value !== key ? value : null;
  }

  private setOrRemove(name: string, content: string | null): void {
    const selector = name.startsWith('og:') ? `property='${name}'` : `name='${name}'`;

    if (content === null || content === '') {
      this.meta.removeTag(selector);
      return;
    }

    this.meta.updateTag(
      name.startsWith('og:') ? { property: name, content } : { name, content },
      selector,
    );
  }

  private setCanonical(href: string | null): void {
    this.setLink('canonical', null, href);
  }

  private setAlternates(path: string | null): void {
    for (const language of APP_LANGUAGES) {
      this.setLink(
        'alternate',
        language,
        path === null ? null : `${SITE_ORIGIN}${swapLanguageInPath(path, language)}`,
      );
    }

    // `x-default` is the negotiating root, which answers a visitor whose language this site
    // does not publish. It is `/`, so the choice stays one decision in one place.
    this.setLink('alternate', 'x-default', path === null ? null : `${SITE_ORIGIN}/`);
  }

  /**
   * Find-or-create a `<link>`, matched on `rel` and `hreflang` together, because the alternates
   * differ only by `hreflang`.
   *
   * CAUTION: Keep `Array.from` instead of a spread. The server renders through domino, whose
   * `NodeList` is array-like but has no `Symbol.iterator`, so a spread throws there and only
   * there. A `subscribe` swallowed that throw, the build reported success, and every prerendered
   * page shipped with no `canonical` and no `hreflang`. Angular's `Meta` service does the same.
   */
  private setLink(rel: string, hreflang: string | null, href: string | null): void {
    const head = this.document.head;
    const existing = Array.from(head.querySelectorAll('link')).find(
      (link) => link.getAttribute('rel') === rel && link.getAttribute('hreflang') === hreflang,
    );

    if (href === null) {
      existing?.remove();
      return;
    }

    const link = existing ?? this.document.createElement('link');
    link.setAttribute('rel', rel);
    if (hreflang !== null) link.setAttribute('hreflang', hreflang);
    link.setAttribute('href', href);
    if (existing === undefined) head.appendChild(link);
  }
}

function pathWithoutQuery(url: string): string {
  const path = url.split(/[?#]/, 1)[0] ?? '/';
  // `/el/` and `/el` are the same page, so the canonical must name one of them.
  return path.length > 1 && path.endsWith('/') ? path.slice(0, -1) : path;
}

function deepestRoute(root: ActivatedRouteSnapshot): ActivatedRouteSnapshot {
  let route = root;
  while (route.firstChild !== null) route = route.firstChild;
  return route;
}

/**
 * Angular inherits route `data` down the tree only on request. Reading upward lets a page put its
 * description on whichever route owns the content.
 */
function readDescriptionKey(route: ActivatedRouteSnapshot): string | undefined {
  for (let current: ActivatedRouteSnapshot | null = route; current; current = current.parent) {
    const description: unknown = current.data['description'];
    if (typeof description === 'string' && description !== '') return description;
  }
  return undefined;
}

function isPublicPage(path: string): boolean {
  const language = languageFromPath(path);
  if (language === null) return false;

  const page = path.slice(`/${language}`.length).replace(/^\//, '');
  return (PUBLIC_PAGE_PATHS as readonly string[]).includes(page);
}
