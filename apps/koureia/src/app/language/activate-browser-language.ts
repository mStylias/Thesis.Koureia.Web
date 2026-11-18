import { DOCUMENT, isPlatformBrowser } from '@angular/common';
import { PLATFORM_ID, inject } from '@angular/core';
import { ResolveFn } from '@angular/router';
import { TranslocoService } from '@jsverse/transloco';
import { ActiveLanguage, AppLanguage, DEFAULT_APP_LANGUAGE } from '@util/language';

import { readUiLanguageCookie } from '../../language-cookie';

/**
 * Sets the active language for an address that carries no `:lang` segment.
 *
 * The `activateLanguage` of `LANGUAGE_FREE_PAGE_PATHS`, and it has the same ordering constraint:
 * a parent `resolve` is the only hook that runs before a child resolver, and the management
 * shell's `preloadManagementTranslations` reads `getActiveLang()` to decide which dictionaries
 * to fetch. Without this the workspace renders Greek to an English account, because Transloco is
 * still on `defaultLang`.
 *
 * The mirror cookie and not the session `locale` claim, even though the account is the store of
 * record: `LOCALE_ID` is fixed at bootstrap and reads the same cookie, so a second source here
 * would format dates in one language and words in another. `MirrorSessionLanguage` is the one
 * place that reconciles the cookie with the account.
 *
 * It loads no dictionary. Every page under a language-free address loads its own, and this
 * resolver runs first so they load the right one.
 */
export const activateBrowserLanguage: ResolveFn<AppLanguage> = () => {
  const transloco = inject(TranslocoService);
  const active = inject(ActiveLanguage);

  // Test the platform, not the document: platform-server installs a domino `Window`, so a
  // `defaultView` probe passes and `document.cookie` then throws. These addresses render in the
  // browser today — see the `RenderMode.Client` entry in `app.routes.server.ts` — and this keeps
  // a change of render mode from being a crash.
  const language = isPlatformBrowser(inject(PLATFORM_ID))
    ? (readUiLanguageCookie(inject(DOCUMENT).cookie) ?? DEFAULT_APP_LANGUAGE)
    : DEFAULT_APP_LANGUAGE;

  transloco.setActiveLang(language);
  active.set(language);

  return language;
};
