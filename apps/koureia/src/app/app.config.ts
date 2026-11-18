import {
  ApplicationConfig,
  Injector,
  inject,
  isDevMode,
  provideAppInitializer,
  provideBrowserGlobalErrorListeners,
} from '@angular/core';
import { provideRouter, TitleStrategy, withInMemoryScrolling } from '@angular/router';
import { provideTransloco } from '@jsverse/transloco';
import { isApiUrl, provideApi, PUBLIC_TRANSFERABLE } from '@api/core';
import {
  SessionStore,
  authTokenInterceptor,
  companyScopeInterceptor,
  provideBeforeSignOut,
} from '@auth/data-access';
import { LANGUAGE_PREFERENCE } from '@features/language';
import { PushReminders, REMINDERS_ACCOUNT, providePushReminders } from '@features/reminders';
import { provideBrand } from '@util/brand';

import { AdoptChosenLanguage } from './language/adopt-chosen-language';
import { MirrorSessionLanguage } from './language/mirror-session-language';
import { LanguagePreferenceStore } from './language/language-preference.store';

import { routes } from './app.routes';
import { provideClientHydration, withHttpTransferCacheOptions } from '@angular/platform-browser';
import { environment } from '../environments/environment';
import { provideUserResourceSavedViews } from '@features/saved-views';
import { provideColumnChooser } from './column-chooser';
import { provideExcelBranding } from './excel-branding';
import { providePdfExport } from './pdf-export';
import { provideAppLanguage } from './language.providers';
import { PageMetadata } from './seo/page-metadata';
import { AppTitleStrategy } from './title-strategy';
import { ManagementEntryStore } from './management-entry.store';
import { StaffSignInRedirect } from './staff-sign-in-redirect';
import { AppTranslocoLoader } from './transloco-loader';
import { provideAppErrorMessages } from './error-messages';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(
      routes,
      withInMemoryScrolling({
        anchorScrolling: 'enabled',
        scrollPositionRestoration: 'enabled',
      }),
      // No `withViewTransitions()`. While a transition runs, the browser hit-tests its snapshot
      // instead of the page, so clicks do nothing and the cursor drops to the arrow.
    ),
    { provide: TitleStrategy, useClass: AppTitleStrategy },
    provideApi({
      baseUrl: environment.apiUrl,
      // Inside `apiInterceptor` on purpose: it sees the raw `HttpErrorResponse`, and whatever it
      // passes on still maps to an `ApiError`.
      interceptors: [authTokenInterceptor, companyScopeInterceptor],
    }),
    provideAppErrorMessages(),
    provideAppInitializer(() => {
      void inject(SessionStore).bootstrap();
    }),
    provideAppInitializer(() => {
      inject(StaffSignInRedirect).start();
    }),
    // Angular's own locale, from the language in the path. Transloco does not move `LOCALE_ID`,
    // and a Greek page with American dates throws nothing.
    provideAppLanguage(),
    // Subscribed here, not in a component, so it listens before the first navigation resolves.
    // The head must be right in the HTML the server sends.
    provideAppInitializer(() => {
      inject(PageMetadata).start();
    }),
    // The app's half of the language switcher, which remembers a deliberate choice. The switcher
    // knows nothing about the brand or the account, so it cannot decide this.
    { provide: LANGUAGE_PREFERENCE, useExisting: LanguagePreferenceStore },
    // Started here rather than from `App`, so it is listening before the first navigation: a
    // cold load straight to `/management` is exactly the case the splash exists for.
    provideAppInitializer(() => {
      inject(ManagementEntryStore).start();
    }),
    // Carries a language chosen before sign-in onto the account, once.
    provideAppInitializer(() => {
      inject(AdoptChosenLanguage).start();
    }),
    // Keeps the cookie the language-free pages read in step with the account.
    provideAppInitializer(() => {
      inject(MirrorSessionLanguage).start();
    }),
    // The app's half of push reminders: the session the library may not import, the start-up
    // sync, and push off on sign-out, so a shared computer does not show one person's reminders
    // to the next.
    {
      provide: REMINDERS_ACCOUNT,
      useFactory: () => {
        const session = inject(SessionStore);
        return { signedIn: session.isSignedIn, verified: session.isEmailVerified };
      },
    },
    providePushReminders(),
    // Resolved at sign-out, not here: `PushReminders` reads the session through
    // `REMINDERS_ACCOUNT`, and `SessionStore` reads this hook, so an eager inject is a cycle.
    provideBeforeSignOut(() => {
      const injector = inject(Injector);
      return () => injector.get(PushReminders).disable();
    }),
    // Where a grid's named views are kept. Application-wide, because the store
    // is the account's rather than any one screen's; a grid still opts in with
    // `gridViews({ key })`.
    provideUserResourceSavedViews(),
    provideClientHydration(
      withHttpTransferCacheOptions({
        // Keep API responses out until personal renders and cached routes use separate rules.
        // A public, anonymous read opts back in with `PUBLIC_TRANSFERABLE`, which is what stops
        // a server-rendered page from refetching its own content at hydration.
        filter: (req) =>
          !isApiUrl(req.url, environment.apiUrl) || req.context.get(PUBLIC_TRANSFERABLE),
      }),
    ),
    // The one place this app names its brand. Shared UI and feature libraries read the `BRAND`
    // token instead of hardcoding the name, the logo or the imagery.
    provideBrand({
      id: 'koureia',
      name: 'Koureia',
      wordmark: 'koureia',
      logo: '/brand/koureia_icon.png',
      heroImage: '/images/hero-barbershop.webp',
      defaultTheme: 'system',
    }),
    // What a spreadsheet export wears. Derived from the brand above and from the theme's own
    // tokens, so no grid and no screen names a hue of its own.
    provideExcelBranding(),
    providePdfExport(),
    // A floating panel on a desktop, a popover below it. The screen size decides, not the grid.
    provideColumnChooser(),
    // A Greek-first product. English is the fallback for a missing key or an unknown language.
    provideTransloco({
      config: {
        availableLangs: ['el', 'en'],
        defaultLang: 'el',
        fallbackLang: 'en',
        missingHandler: { useFallbackTranslation: true },
        reRenderOnLangChange: true,
        prodMode: !isDevMode(),
      },
      loader: AppTranslocoLoader,
    }),
  ],
};
