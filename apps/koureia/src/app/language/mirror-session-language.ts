import { DOCUMENT, isPlatformBrowser } from '@angular/common';
import {
  DestroyRef,
  Injector,
  PLATFORM_ID,
  Service,
  effect,
  inject,
  untracked,
} from '@angular/core';
import { SessionStore } from '@auth/data-access';
import { AppLanguage, toAppLanguage } from '@util/language';

import {
  UI_LANGUAGE_COOKIE,
  readLanguageCookie,
  readUiLanguageCookie,
  writeLanguageCookieValue,
} from '../../language-cookie';
import { isLanguageFreePath } from '../language-free-pages';

/**
 * Keeps the mirror cookie in step with the account.
 *
 * The account is the store of record and the cookie is only what the browser can read before the
 * session answers. They agree on every browser that made the choice, and disagree on the first
 * visit from a new one: an English account on a fresh device reads the missing cookie as Greek.
 *
 * The claim is trustworthy for this, because `/auth/language` re-seals the session cookie on
 * every deliberate change. See `SessionStore.adoptLanguage`.
 *
 * Only a language-free address reloads. Everywhere else the language is in the URL, which is
 * a statement, and correcting it against an account would undo a person following a link.
 */
@Service()
export class MirrorSessionLanguage {
  private readonly session = inject(SessionStore);
  private readonly document = inject(DOCUMENT);
  private readonly destroyRef = inject(DestroyRef);
  private readonly injector = inject(Injector);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  private corrected = false;

  /** Called once from `provideAppInitializer`, before the first navigation resolves. */
  start(): void {
    if (!this.isBrowser) return;

    const runner = effect(
      () => {
        if (!this.session.isSignedIn()) return;

        // A tracked read. The sign-in hint answers optimistically with no claims, and there is
        // nothing to mirror until the real ones arrive.
        const claims = this.session.claims();
        if (claims === null) return;

        if (this.corrected) return;
        this.corrected = true;

        untracked(() => {
          this.mirror(toAppLanguage(claims.locale));
        });
      },
      { injector: this.injector },
    );

    this.destroyRef.onDestroy(() => {
      runner.destroy();
    });
  }

  private mirror(stored: AppLanguage | null): void {
    if (stored === null) return;

    // An anonymous choice not carried into the account yet. `AdoptChosenLanguage` settles that
    // question, and mirroring the claim it is about to replace would undo the choice.
    if (readLanguageCookie(this.document.cookie) !== null) return;

    if (readUiLanguageCookie(this.document.cookie) === stored) return;

    this.document.cookie = writeLanguageCookieValue(
      UI_LANGUAGE_COOKIE,
      stored,
      this.document.location.protocol === 'https:',
    );

    // `LOCALE_ID` is fixed at bootstrap and the shell's dictionaries are already loaded, so the
    // new language needs a new injector. Once per page load, because `corrected` is set before
    // this runs and the cookie now agrees.
    if (isLanguageFreePath(this.document.location.pathname)) this.document.location.reload();
  }
}
