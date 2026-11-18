import { inject } from '@angular/core';
import { ResolveFn, Route } from '@angular/router';
import { TranslocoService } from '@jsverse/transloco';
import { preloadSiteHeaderTranslations } from '@features/site-layout';
import { forkJoin, map } from 'rxjs';
import { Landing } from './landing';
import { landingInlineLoader } from './landing.i18n';

/** Resolves translations before SSR/prerendering and client-side route activation. */
const preloadLandingTranslations: ResolveFn<boolean> = () => {
  const transloco = inject(TranslocoService);
  const lang = transloco.getActiveLang();

  // The root dictionary loads alongside the scope, not just the scope: the
  // brand-bearing copy lives in the app's `brand.landing.*` keys (see
  // `LandingBrandCopy`), and prerendering must not race it.
  return forkJoin([
    transloco.load(lang),
    transloco.load(`landing/${lang}`, { inlineLoader: landingInlineLoader }),
  ]).pipe(map(() => true));
};

export const landingRoutes: Route[] = [
  {
    path: '',
    component: Landing,
    resolve: {
      translations: preloadLandingTranslations,
      headerTranslations: preloadSiteHeaderTranslations,
    },
    children: [
      {
        path: '',
        loadComponent: () => import('./landing-home/landing-home').then((m) => m.LandingHome),
        title: 'titles.home',
        // Both are app-owned root keys, like `title` beside them: the tab title and the
        // search-result snippet are the same kind of per-page, per-language copy, and the
        // app is where copy that names the brand lives. Read by `PageMetadata`.
        data: { description: 'descriptions.home' },
      },
      {
        path: 'how-it-works',
        loadComponent: () =>
          import('./landing-how-it-works/landing-how-it-works').then((m) => m.LandingHowItWorks),
        title: 'titles.how',
        data: { description: 'descriptions.how' },
      },
    ],
  },
];
