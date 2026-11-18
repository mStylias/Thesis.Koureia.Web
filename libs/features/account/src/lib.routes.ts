import { inject } from '@angular/core';
import type { ResolveFn, Route } from '@angular/router';
import { TranslocoService } from '@jsverse/transloco';
import { preloadBarbershopsTranslations } from '@features/barbershops';
import { preloadSiteHeaderTranslations } from '@features/site-layout';
import { SYNAX_ERROR_MESSAGES } from '@synax/client';
import { forkJoin, map } from 'rxjs';

import { customerSignedInGuard } from './account-access.guard';
import { accountErrorMessages } from './account-errors';
import { accountInlineLoader } from './account.i18n';
import { AccountShell } from './shell/account-shell';
import {
  APPOINTMENT_PAGE,
  appointmentPageResolver,
} from './appointments/appointment/account-appointment.resolvers';

/**
 * Loads the account copy before the server render. The root dictionary loads alongside the scope
 * because the page titles are app-owned `titles.account.*` keys.
 */
const preloadAccountTranslations: ResolveFn<boolean> = () => {
  const transloco = inject(TranslocoService);
  const lang = transloco.getActiveLang();

  return forkJoin([
    transloco.load(lang),
    transloco.load(`account/${lang}`, { inlineLoader: accountInlineLoader }),
  ]).pipe(map(() => true));
};

/**
 * The signed-in customer's own area, under `/{lang}/account`.
 *
 * Not in `PUBLIC_PAGE_PATHS`: it is personal, so it is neither prerendered nor in the sitemap.
 * `app.routes.server.ts` carries the entry that keeps it out of the 404 wildcard.
 */
export const accountRoutes: Route[] = [
  {
    path: '',
    component: AccountShell,
    canActivate: [customerSignedInGuard],
    resolve: {
      translations: preloadAccountTranslations,
      headerTranslations: preloadSiteHeaderTranslations,
    },
    providers: [{ provide: SYNAX_ERROR_MESSAGES, useFactory: accountErrorMessages }],
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'appointments' },
      {
        path: 'appointments',
        loadComponent: () =>
          import('./appointments/account-appointments').then((m) => m.AccountAppointments),
        title: 'titles.account.appointments',
      },
      {
        path: 'appointments/:id',
        loadComponent: () =>
          import('./appointments/appointment/account-appointment').then(
            (m) => m.AccountAppointment,
          ),
        // The map and its Google Maps links read the `barbershops` dictionary.
        resolve: {
          [APPOINTMENT_PAGE]: appointmentPageResolver,
          barbershopsTranslations: preloadBarbershopsTranslations,
        },
        // `always`, so the error state's retry re-runs the resolver for the same address.
        runGuardsAndResolvers: 'always',
        title: 'titles.account.appointment',
        // The appointment and the shop's location sit side by side.
        data: { wide: true },
      },
      {
        path: 'reviews',
        loadComponent: () => import('./reviews/account-reviews').then((m) => m.AccountReviews),
        title: 'titles.account.reviews',
      },
      {
        path: 'profile',
        loadComponent: () => import('./profile/account-profile').then((m) => m.AccountProfile),
        title: 'titles.account.profile',
      },
      {
        path: 'settings',
        loadComponent: () => import('./settings/account-settings').then((m) => m.AccountSettings),
        title: 'titles.account.settings',
      },
    ],
  },
];
