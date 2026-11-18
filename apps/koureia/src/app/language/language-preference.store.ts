import { DOCUMENT } from '@angular/common';
import { ErrorHandler, Service, inject } from '@angular/core';
import { UserProfileApi } from '@api/users';
import { SessionStore } from '@auth/data-access';
import { LanguagePreference } from '@features/language';
import { AppLanguage } from '@util/language';
import { firstValueFrom } from 'rxjs';

import {
  LANGUAGE_COOKIE,
  UI_LANGUAGE_COOKIE,
  writeLanguageCookieValue,
} from '../../language-cookie';

/**
 * Remembers a deliberate language choice: in the account when there is one, in a cookie when
 * there is not.
 *
 * The app's half of `LANGUAGE_PREFERENCE`. The switcher knows about languages and this knows
 * about people. It lives here because the choice between the two stores needs the session, which
 * a `scope:shared` library cannot read.
 *
 * A signed-in visitor writes no cookie. The profile is then the store of record, and two stores
 * would give one question two answers, with the cookie outliving the sign-out.
 */
@Service()
export class LanguagePreferenceStore implements LanguagePreference {
  private readonly session = inject(SessionStore);
  private readonly profile = inject(UserProfileApi);
  private readonly document = inject(DOCUMENT);
  private readonly errors = inject(ErrorHandler);

  async persist(language: AppLanguage): Promise<void> {
    // Both branches write it: the language-free pages read this cookie before the session
    // answers, so a choice a signed-in barber makes on the site must reach them too.
    this.writeCookie(UI_LANGUAGE_COOKIE, language);

    if (this.session.isSignedIn()) {
      await this.writeToProfile(language);
      return;
    }

    this.writeCookie(LANGUAGE_COOKIE, language);
  }

  /**
   * Reported through `ErrorHandler`, not a dev-only `console.error`. The visitor still gets the
   * language they asked for, so there is nothing to interrupt them with — but a write that fails
   * for everybody has to be countable somewhere, and this silence is why the last one ran for the
   * lifetime of the feature unnoticed.
   *
   * The session carries a `locale` claim that the server reads before anything else, and the
   * profile reaches it through the API's outbox and the next token refresh. Moving it here is
   * what makes the choice survive the next visit to `/` instead of lasting until the page
   * changes. Second and separate, because the profile is the store of record: a claim moved
   * against a profile that refused the write would say the choice was kept when it was not.
   */
  private async writeToProfile(language: AppLanguage): Promise<void> {
    try {
      await firstValueFrom(this.profile.updatePreferredLanguage(language));
    } catch (error) {
      this.errors.handleError(
        new Error(`[language] could not store the preference "${language}"`, { cause: error }),
      );
      return;
    }

    try {
      await this.session.adoptLanguage(language);
    } catch (error) {
      this.errors.handleError(
        new Error(`[language] could not move the session claim to "${language}"`, { cause: error }),
      );
    }
  }

  private writeCookie(
    name: typeof LANGUAGE_COOKIE | typeof UI_LANGUAGE_COOKIE,
    language: AppLanguage,
  ): void {
    this.document.cookie = writeLanguageCookieValue(
      name,
      language,
      this.document.location.protocol === 'https:',
    );
  }
}
