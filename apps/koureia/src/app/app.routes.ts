import { inject } from '@angular/core';
import { ResolveFn, Route, Routes } from '@angular/router';
import { TranslocoService } from '@jsverse/transloco';
import { remindersRoutes } from '@features/reminders';
import { activateLanguage, languageMatches } from '@util/language';
import { provideCustomerUiCopy } from '@util/ui-copy';
import { map } from 'rxjs';

import { activateBrowserLanguage } from './language/activate-browser-language';

/**
 * Loads the root dictionary for the active language. Only the routes outside `:lang` need it,
 * because `activateLanguage` covers the rest. Together they stop a route from rendering a title
 * key before its dictionary arrives.
 */
const preloadRootTranslations: ResolveFn<boolean> = () => {
  const transloco = inject(TranslocoService);
  return transloco.load(transloco.getActiveLang()).pipe(map(() => true));
};

/**
 * Answers an unpublished address. Used twice, inside the language prefix and at the root, because
 * `/el/foo` and `/foo` are both nothing and only one has a language to render in.
 */
const notFoundRoute: Route = {
  path: '**',
  loadComponent: () => import('./not-found/not-found').then((m) => m.NotFound),
  resolve: { translations: preloadRootTranslations },
  title: 'titles.notFound',
};

/** The pages, once. This one table publishes every page at `/el/…` and `/en/…`. */
const localizedRoutes: Routes = [
  {
    path: 'barbershops',
    loadChildren: () => import('@features/barbershops').then((m) => m.barbershopsRoutes),
  },
  // Personal, like `verify-email` below: not in `PUBLIC_PAGE_PATHS`, with its own entry in
  // `app.routes.server.ts`.
  {
    path: 'account',
    loadChildren: () => import('@features/account').then((m) => m.accountRoutes),
  },
  // Not in `PUBLIC_PAGE_PATHS`: it is an account page, so it is neither prerendered nor in the
  // sitemap. `app.routes.server.ts` carries the matching entry that keeps it out of the 404
  // wildcard.
  {
    path: 'verify-email',
    loadChildren: () => import('@auth/feature-verify-email').then((m) => m.verifyEmailRoutes),
  },
  // The unsubscribe link of the reminder emails. Not in `PUBLIC_PAGE_PATHS`, with its own entry
  // in `app.routes.server.ts`.
  // The page itself is a lazy `loadComponent`. The library is static, because the app config
  // and the site layout import it.
  { path: 'reminders', children: remindersRoutes },
  {
    path: '',
    loadChildren: () => import('@features/landing').then((m) => m.landingRoutes),
  },
  notFoundRoute,
];

export const routes: Routes = [
  {
    path: ':lang',
    // `canMatch`, not a guard inside the route: an unknown first segment must fail to match so
    // the wildcard below answers it. `/foo` is a 404, not a language.
    canMatch: [languageMatches],
    // A parent `resolve` runs before every child resolver, the only place early enough to set
    // the language. See `activateLanguage`.
    resolve: { lang: activateLanguage },
    // Shared controls speak the customer singular here. `/management` keeps their own copy.
    providers: [provideCustomerUiCopy()],
    // Every public page renders the site footer. `/management` is outside this layout.
    loadChildren: () =>
      import('@features/site-layout').then((m) => m.withSiteLayout(localizedRoutes)),
  },
  // Deliberately outside `:lang`: the barber's own workspace is one address, `/management`, and
  // not two. It sits after `:lang` because `canMatch` refuses `management` as a language and
  // lets it fall through. See `LANGUAGE_FREE_PAGE_PATHS`, whose Express and server-route entries
  // must stay in step.
  {
    path: 'management',
    // The `activateLanguage` of an address with no `:lang`, and the same ordering constraint: it
    // must run before the shell's own resolver picks the dictionaries.
    resolve: { lang: activateBrowserLanguage },
    loadChildren: () => import('@features/management-layout').then((m) => m.managementRoutes),
  },
  // Express negotiates `/` and redirects to a language before Angular is reached. This entry
  // keeps the Router from erroring when a dev-server refresh bootstraps the app there.
  { path: '', pathMatch: 'full', children: [] },
  {
    path: '',
    providers: [provideCustomerUiCopy()],
    loadChildren: () =>
      import('@features/site-layout').then((m) => m.withSiteLayout([notFoundRoute])),
  },
];
