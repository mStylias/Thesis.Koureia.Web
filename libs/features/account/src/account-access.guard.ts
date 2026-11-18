import { inject } from '@angular/core';
import { CanActivateFn, RedirectCommand, Router } from '@angular/router';
import { SessionStore } from '@auth/data-access';
import { DEFAULT_APP_LANGUAGE, languageFromPath, withLanguagePrefix } from '@util/language';

/**
 * Guards the customer account: every page under `/{lang}/account` is the signed-in person's own.
 *
 * - **Signed out** — start sign-in and come back to the address that was asked for.
 * - **Email not verified** — the verification screen, then back here. The API refuses every
 *   account call until the address is proven.
 * - **Otherwise** — through.
 *
 * The account renders in the browser only (see `app.routes.server.ts`), so sign-in is always a
 * document load from here.
 */
export const customerSignedInGuard: CanActivateFn = async (_route, state) => {
  const session = inject(SessionStore);
  const router = inject(Router);

  await session.whenReady();

  if (!session.isSignedIn()) {
    // `false` and not a redirect: the navigation is abandoned for a document load.
    session.signIn(state.url);
    return false;
  }

  if (!session.isEmailVerified()) {
    // Guards run before the `:lang` resolver, so the address is what knows the language.
    const language = languageFromPath(state.url) ?? DEFAULT_APP_LANGUAGE;
    const verify = router.parseUrl(withLanguagePrefix('/verify-email', language));
    verify.queryParams = { returnUrl: state.url };
    return new RedirectCommand(verify);
  }

  return true;
};
