import { InjectionToken } from '@angular/core';
import { AppLanguage } from '@util/language';

/**
 * Where an explicit language choice is stored.
 *
 * The switcher navigates. Something else remembers the choice, and it must, because the
 * storage depends on the session. An anonymous visitor gets a cookie, so the next visit and
 * the negotiating root can honor it. A signed-in person gets their profile, through
 * `PATCH /users/me`, so the URL and the stored preference cannot disagree.
 *
 * This is a token and not a service because the choice between those two needs the session,
 * and the session lives in `@auth/data-access`, which is `scope:auth`. A `scope:shared`
 * library must not depend on it. The boundary is correct here: a switcher that required an
 * auth library could not ship in an app with no accounts. The app supplies the half that knows
 * about people, and this library keeps the half that knows about languages.
 *
 * The token is optional. Without a provider the switcher still switches, and it forgets.
 */
export interface LanguagePreference {
  /**
   * Records a language the person chose deliberately.
   *
   * The switcher awaits this before it navigates, so the page cannot unload halfway through a
   * `PATCH`. An implementation must resolve, and not reject, on a storage failure. A lost
   * preference costs less than a blocked switch.
   */
  persist(language: AppLanguage): Promise<void>;
}

export const LANGUAGE_PREFERENCE = new InjectionToken<LanguagePreference>('LANGUAGE_PREFERENCE');
