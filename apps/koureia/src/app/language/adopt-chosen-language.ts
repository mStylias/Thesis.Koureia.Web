import { DOCUMENT, isPlatformBrowser } from '@angular/common';
import {
  DestroyRef,
  ErrorHandler,
  Injector,
  PLATFORM_ID,
  Service,
  effect,
  inject,
  untracked,
} from '@angular/core';
import { UserProfileApi } from '@api/users';
import { SessionStore } from '@auth/data-access';
import { AppLanguage, swapLanguageInPath, toAppLanguage } from '@util/language';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';

import {
  LANGUAGE_COOKIE,
  UI_LANGUAGE_COOKIE,
  clearLanguageCookieValue,
  readLanguageCookie,
  writeLanguageCookieValue,
} from '../../language-cookie';
import { isRetryableWriteFailure } from './write-failure';

/**
 * Carries a language chosen before sign-in into the account that was just signed into.
 *
 * Somebody switches the site to English while anonymous, then signs in to a profile that still
 * says Greek. Without this, a default they never set undoes a deliberate choice. The cookie is
 * written only while anonymous, so its presence is the signal.
 *
 * CAUTION: Clear the cookie on every path that settles the question, and only then. A cookie
 * left in place after a successful write re-issues the same `PATCH` on every page load.
 *
 * A failure is not settled, so the cookie survives one: an unreachable API used to discard a
 * deliberate choice silently, which is worse than the repeat it was avoiding. Only a failure that
 * a retry could fix keeps the cookie — see `isRetryableWriteFailure`.
 *
 * The claim itself is moved here as well, through `SessionStore.adoptLanguage`, so the
 * negotiating root and `MirrorSessionLanguage` do not read a stale one and hand back the
 * language this just replaced.
 */
@Service()
export class AdoptChosenLanguage {
  private readonly session = inject(SessionStore);
  private readonly profile = inject(UserProfileApi);
  private readonly document = inject(DOCUMENT);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  private readonly injector = inject(Injector);
  private readonly errors = inject(ErrorHandler);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  private adopted = false;

  /**
   * Called once from `provideAppInitializer`. Browser only, because the server has no cookie to
   * write.
   *
   * CAUTION: Test the platform, not the document. Platform-server installs a domino `Window` on
   * `document.defaultView`, so a `defaultView` probe passes during SSR and then throws
   * `NotYetImplemented` on the first `document.cookie` read.
   */
  start(): void {
    if (!this.isBrowser) return;

    // An explicit injector, because an app initializer that turns async loses the injection
    // context this call would otherwise depend on.
    const runner = effect(
      () => {
        if (!this.session.isSignedIn()) return;

        // CAUTION: A tracked read, and the reason `adopted` exists. A prerendered page carries no
        // transfer state, so `SessionStore` answers the sign-in hint cookie optimistically with no
        // claims. Adopting in that window compares the cookie against nothing, never agrees, and
        // reloads the page to store a language the account can already hold.
        if (this.session.claims() === null) return;

        // The claims can change again, from a token refresh or another tab. One adoption per page
        // is the whole of it, and a second one is a second `PATCH` for a cookie already cleared.
        if (this.adopted) return;
        this.adopted = true;

        untracked(() => {
          void this.adopt();
        });
      },
      { injector: this.injector },
    );

    this.destroyRef.onDestroy(() => {
      runner.destroy();
    });
  }

  private async adopt(): Promise<void> {
    const chosen = readLanguageCookie(this.document.cookie);
    if (chosen === null) {
      // No anonymous choice to carry, so the profile wins without argument.
      return;
    }

    const stored = toAppLanguage(this.session.claims()?.locale ?? null);
    if (stored === chosen) {
      // The account already says what the cookie asks for. Question settled, nothing to write.
      this.clearCookie();
      return;
    }

    if (!(await this.store(chosen))) return;

    this.clearCookie();

    // The account now says what the mirror must, and the reload below renders from it.
    this.writeMirror(chosen);

    // A document navigation, not `router.navigateByUrl`. `LOCALE_ID` is fixed at bootstrap and
    // does not follow Transloco, so the new language needs a new injector or the page formats
    // dates in the old locale.
    this.document.location.assign(swapLanguageInPath(this.router.url, chosen));
  }

  private async store(language: AppLanguage): Promise<boolean> {
    try {
      await firstValueFrom(this.profile.updatePreferredLanguage(language));
    } catch (error) {
      this.errors.handleError(
        new Error(`[language] could not adopt the chosen language "${language}"`, { cause: error }),
      );

      // A request this account can never get right must not be re-sent on every page load. The
      // choice is lost either way, and the report above is what says so.
      if (!isRetryableWriteFailure(error)) this.clearCookie();

      return false;
    }

    // Second and separate, because the profile is the store of record. The `locale` claim is
    // sealed into the session cookie and otherwise follows the profile only at the next token
    // refresh, which is long enough for the negotiating root and `MirrorSessionLanguage` to read
    // the language this just replaced and hand it back.
    try {
      await this.session.adoptLanguage(language);
    } catch (error) {
      this.errors.handleError(
        new Error(`[language] could not move the session claim to "${language}"`, { cause: error }),
      );
    }

    return true;
  }

  private clearCookie(): void {
    this.document.cookie = clearLanguageCookieValue(LANGUAGE_COOKIE, this.isSecure());
  }

  private writeMirror(language: AppLanguage): void {
    this.document.cookie = writeLanguageCookieValue(UI_LANGUAGE_COOKIE, language, this.isSecure());
  }

  private isSecure(): boolean {
    return this.document.location.protocol === 'https:';
  }
}
