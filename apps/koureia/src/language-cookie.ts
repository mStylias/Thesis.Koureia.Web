import { AppLanguage, toAppLanguage } from '@util/language';

/**
 * The explicit-choice cookie: a language somebody clicked while anonymous, and only that.
 *
 * Negotiation never writes it, so a guess about a device does not survive and a statement about a
 * person does. Sign-out clears it, or the second barber on a shop tablet inherits the first one's
 * language. `AdoptChosenLanguage` clears it as soon as the choice reaches the account, so its
 * presence means "chosen before sign-in and not carried yet".
 *
 * NOTE: This is a separate file because both sides need the name. Express reads it to negotiate
 * `/`, and the browser writes it from the switcher. `language-routes.ts` imports Express, so the
 * name cannot live there without dragging a Node server into the browser bundle.
 */
export const LANGUAGE_COOKIE = 'koureia.lang';

/**
 * The language this browser renders in, mirrored from whatever settled the question.
 *
 * A separate cookie and not a wider meaning for {@link LANGUAGE_COOKIE}: that one is the signal
 * `AdoptChosenLanguage` waits for, and a mirror written from the account would answer it with
 * the account's own language and carry nothing.
 *
 * It exists for the addresses in `LANGUAGE_FREE_PAGE_PATHS`, which have no language in the path
 * and are rendered in the browser. `LOCALE_ID` is fixed at bootstrap and the shell's dictionaries
 * load from a resolver, so both need an answer before the session round trip returns. A cookie is
 * the only source that is there that early. The account stays the store of record and
 * `MirrorSessionLanguage` corrects this against it.
 */
export const UI_LANGUAGE_COOKIE = 'koureia.ui-lang';

/** How long a written language cookie lives. A shorter life keeps nothing. */
const COOKIE_MAX_AGE_SECONDS = 31536000;

/** The language a visitor chose. `null` means nobody said. */
export function readLanguageCookie(cookieHeader: string | undefined): AppLanguage | null {
  return readCookieLanguage(cookieHeader, LANGUAGE_COOKIE);
}

/** The language this browser last rendered in. `null` means nothing settled it yet. */
export function readUiLanguageCookie(cookieHeader: string | undefined): AppLanguage | null {
  return readCookieLanguage(cookieHeader, UI_LANGUAGE_COOKIE);
}

/** The `Set-Cookie` that removes it, for sign-out and for an adopted choice. */
export function clearLanguageCookieHeader(secure: boolean): string {
  return `${LANGUAGE_COOKIE}=; ${cookieAttributes(secure, 0).join('; ')}`;
}

/** The `Set-Cookie` that removes the mirror. Sign-out clears both, for the same tablet. */
export function clearUiLanguageCookieHeader(secure: boolean): string {
  return `${UI_LANGUAGE_COOKIE}=; ${cookieAttributes(secure, 0).join('; ')}`;
}

/**
 * The `document.cookie` assignment that writes one of these, for the browser half.
 *
 * Not `HttpOnly`, because the browser writes it and a language is no secret. `SameSite=Lax` so it
 * survives the return leg of a sign-in redirect.
 */
export function writeLanguageCookieValue(
  name: typeof LANGUAGE_COOKIE | typeof UI_LANGUAGE_COOKIE,
  language: AppLanguage,
  secure: boolean,
): string {
  return `${name}=${language}; ${cookieAttributes(secure, COOKIE_MAX_AGE_SECONDS).join('; ')}`;
}

/** The `document.cookie` assignment that removes one of these. */
export function clearLanguageCookieValue(
  name: typeof LANGUAGE_COOKIE | typeof UI_LANGUAGE_COOKIE,
  secure: boolean,
): string {
  return `${name}=; ${cookieAttributes(secure, 0).join('; ')}`;
}

function cookieAttributes(secure: boolean, maxAge: number): string[] {
  const attributes = ['Path=/', `Max-Age=${maxAge}`, 'SameSite=Lax'];
  if (secure) attributes.push('Secure');
  return attributes;
}

function readCookieLanguage(cookieHeader: string | undefined, name: string): AppLanguage | null {
  if (cookieHeader === undefined) return null;

  for (const part of cookieHeader.split(';')) {
    const [cookieName, ...value] = part.trim().split('=');
    if (cookieName === name) return toAppLanguage(decodeURIComponent(value.join('=')));
  }

  return null;
}
