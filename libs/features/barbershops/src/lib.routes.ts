import { inject } from '@angular/core';
import { ResolveFn, Route } from '@angular/router';
import { TranslocoService } from '@jsverse/transloco';
import { PAGE_META } from '@util/language';
import { map } from 'rxjs';
import { Barbershops } from './barbershops';
import { barbershopsInlineLoader } from './barbershops.i18n';
import {
  BARBERSHOP_PAGE,
  barbershopPageMetaResolver,
  barbershopPageResolver,
} from './barbershop-home/barbershop-home.resolvers';
import {
  BOOKING_PAGE,
  RESCHEDULE_PAGE,
  bookingPageResolver,
  rescheduleResolver,
} from './barbershop-booking/barbershop-booking.resolvers';

/** Loads the `barbershops` dictionary, which `ShopMap` and `ShopMapLinks` read. */
export const preloadBarbershopsTranslations: ResolveFn<boolean> = () => {
  const transloco = inject(TranslocoService);
  const lang = transloco.getActiveLang();

  return transloco
    .load(`barbershops/${lang}`, { inlineLoader: barbershopsInlineLoader })
    .pipe(map(() => true));
};

export const barbershopsRoutes: Route[] = [
  {
    path: '',
    component: Barbershops,
    resolve: { translations: preloadBarbershopsTranslations },
    title: 'titles.barbershops',
    // An app-owned root key, like `title` above it. Read by `PageMetadata` to build the
    // `<meta name="description">` and the OG description for this page's language.
    // The list and the map fill the screen, and the mobile map bar is fixed to its bottom edge.
    data: { description: 'descriptions.barbershops', siteFooter: false },
  },
  {
    path: ':slug',
    resolve: { translations: preloadBarbershopsTranslations },
    children: [
      {
        path: '',
        resolve: { [BARBERSHOP_PAGE]: barbershopPageResolver },
        // `always`, so the error state's retry re-runs the resolver for the same address.
        runGuardsAndResolvers: 'always',
        children: [
          {
            path: '',
            loadComponent: () =>
              import('./barbershop-home/barbershop-home').then((m) => m.BarbershopHome),
            // A child of the route that loads the shop, because a child resolves after its
            // parent and the head is built from the shop.
            resolve: { [PAGE_META]: barbershopPageMetaResolver },
            runGuardsAndResolvers: 'always',
          },
        ],
      },
      {
        path: 'booking',
        children: [
          {
            path: '',
            resolve: {
              [BOOKING_PAGE]: bookingPageResolver,
              [RESCHEDULE_PAGE]: rescheduleResolver,
            },
            // `always`, so the error state's retry re-runs the resolver for the same address.
            runGuardsAndResolvers: 'always',
            loadComponent: () =>
              import('./barbershop-booking/barbershop-booking').then((m) => m.BarbershopBooking),
            title: 'titles.booking',
            // No footer under the flow: the bottom sheet is fixed over the end of the page,
            // and site links are not what this screen is for.
            data: { siteFooter: false },
          },
          {
            // The appointment's own address, so a refresh of the success screen re-reads it
            // rather than showing nothing. The booking page replaces its history entry on the
            // way here, which is what stops back returning to a booking already made.
            path: ':appointmentId',
            loadComponent: () =>
              import('./barbershop-booking/booking-success/booking-success').then(
                (m) => m.BookingSuccess,
              ),
            title: 'titles.bookingConfirmed',
          },
        ],
      },
    ],
  },
];
