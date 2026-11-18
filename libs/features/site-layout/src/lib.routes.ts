import { inject, isDevMode } from '@angular/core';
import type { ResolveFn, Routes } from '@angular/router';
import { TranslocoService } from '@jsverse/transloco';
import { languageInlineLoader } from '@features/language';
import { drawerInlineLoader } from '@ui/drawer';
import { themeToggleInlineLoader } from '@ui/theme-toggle';
import { forkJoin, map } from 'rxjs';

import { SiteLayout } from './site-layout';
import { siteLayoutInlineLoader } from './site-layout.i18n';

/**
 * Loads the footer copy before the page renders. The server render is one shot, so a scope that
 * arrives late ships a footer with keys in it.
 */
const preloadSiteLayoutTranslations: ResolveFn<boolean> = () => {
  const transloco = inject(TranslocoService);
  const lang = transloco.getActiveLang();

  return forkJoin([
    // The wordmark label and the copyright line are root keys.
    transloco.load(lang),
    transloco.load(`siteLayout/${lang}`, { inlineLoader: siteLayoutInlineLoader }),
  ]).pipe(map(() => true));
};

/** Puts `children` inside the public layout, which renders the site footer below each page. */
export function withSiteLayout(children: Routes): Routes {
  return [
    {
      path: '',
      component: SiteLayout,
      resolve: { siteLayoutTranslations: preloadSiteLayoutTranslations },
      children,
    },
  ];
}

/**
 * Loads the copy of `lib-site-header` and of the shared controls it renders. A route that shows
 * the header resolves this.
 *
 * Each control owns its scope and would fetch it on its own. That is fine in the browser, where
 * the pipe re-renders when the chunk lands, and wrong on the server, where the render is one shot
 * and an unresolved scope ships a combobox with no accessible name.
 */
export const preloadSiteHeaderTranslations: ResolveFn<boolean> = () => {
  const transloco = inject(TranslocoService);
  const lang = transloco.getActiveLang();

  return forkJoin([
    transloco.load(`siteLayout/${lang}`, { inlineLoader: siteLayoutInlineLoader }),
    // The header renders the theme toggle in a development build only, so a production render
    // must not pay for a dictionary nothing reads. Same condition as `SiteHeader`.
    ...(isDevMode()
      ? [transloco.load(`themeToggle/${lang}`, { inlineLoader: themeToggleInlineLoader })]
      : []),
    transloco.load(`language/${lang}`, { inlineLoader: languageInlineLoader }),
    // The mobile menu's drawer is in the markup from the first render, closed. A `| transloco`
    // written on the `<lib-drawer>` element resolves through that element's injector, so it
    // waits on the drawer's own chunk before it emits anything.
    transloco.load(`drawer/${lang}`, { inlineLoader: drawerInlineLoader }),
  ]).pipe(map(() => true));
};
