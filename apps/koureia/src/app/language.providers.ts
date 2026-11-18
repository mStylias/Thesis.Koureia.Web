import { DOCUMENT, PlatformLocation, isPlatformBrowser, registerLocaleData } from '@angular/common';
import localeGreek from '@angular/common/locales/el';
import {
  EnvironmentProviders,
  LOCALE_ID,
  PLATFORM_ID,
  inject,
  makeEnvironmentProviders,
} from '@angular/core';
import { DEFAULT_APP_LANGUAGE, languageFromPath } from '@util/language';

import { readUiLanguageCookie } from '../language-cookie';

// Angular ships `en-US` and nothing else, so without this `LOCALE_ID: 'el'` formats dates and
// numbers with English rules under a Greek label.
registerLocaleData(localeGreek);

/**
 * Points Angular's own locale at the language of the current page.
 *
 * `LOCALE_ID` is fixed at bootstrap and does not follow Transloco, so the date, number and
 * currency pipes keep the locale the injector was built with. Reading the path keeps the two in
 * step: the server injector is per request, and a browser language switch is a full navigation.
 *
 * The addresses in `LANGUAGE_FREE_PAGE_PATHS` have no language in the path, so they fall back to
 * the mirror cookie, which is the only source that answers this early. See `UI_LANGUAGE_COOKIE`.
 *
 * CAUTION: This fails silently. Nothing throws, and a Greek page renders `8/11/26` instead of
 * `11/8/26`.
 */
export function provideAppLanguage(): EnvironmentProviders {
  return makeEnvironmentProviders([
    {
      provide: LOCALE_ID,
      // `PlatformLocation` and not `DOCUMENT.location`: it is the one source that answers in a
      // browser render, a server request and a prerender.
      useFactory: () => {
        const fromPath = languageFromPath(inject(PlatformLocation).pathname);
        if (fromPath !== null) return fromPath;

        // Test the platform, not the document: platform-server installs a domino `Window`, so a
        // `defaultView` probe passes during SSR and then throws on the first `document.cookie`
        // read.
        if (!isPlatformBrowser(inject(PLATFORM_ID))) return DEFAULT_APP_LANGUAGE;

        return readUiLanguageCookie(inject(DOCUMENT).cookie) ?? DEFAULT_APP_LANGUAGE;
      },
    },
  ]);
}
