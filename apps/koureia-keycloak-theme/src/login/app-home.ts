import { kcEnvDefaults } from '../kc.gen';
import type { I18n } from './i18n';
import type { KcContext } from './KcContext';

/**
 * Where the site lives, as an absolute URL to resolve other paths against.
 *
 * Keycloak is a separate origin, so a relative path cannot work. The value arrives as a
 * build-time environment variable and lands in `theme.properties` with a default.
 *
 * CAUTION: Keep the fallback. `new URL('/el/', '')` throws, and the frame resolves this on
 * every page, so an empty value blanks every authentication screen instead of one link. It can
 * be empty: a stale JAR, a deployment that sets nothing, or `start-keycloak` without it.
 */
export function appBaseUrl(properties: KcContext['properties']): string {
  const configured = properties.KOUREIA_APP_URL;

  return isAbsoluteUrl(configured) ? configured : kcEnvDefaults.KOUREIA_APP_URL;
}

/**
 * The site home page, in the language of these pages.
 *
 * The frame wordmark and the finished-flow page both use this, because the two must agree on
 * where home is.
 */
export function appHomeUrl(kcContext: KcContext, i18n: I18n): string {
  const language = i18n.currentLanguage.languageTag.startsWith('el') ? 'el' : 'en';

  return new URL(`/${language}/`, appBaseUrl(kcContext.properties)).href;
}

/**
 * The Terms of Service page on the site, in the language of these pages.
 *
 * The registration form and `terms.ftl` both point here, so the document a person accepts is the
 * one the site publishes rather than a second copy in Keycloak.
 *
 * `appUrl` must already be absolute — pass it through {@link appBaseUrl}, which is what
 * guarantees that. `new URL` throws on an empty base, and this is resolved during a template
 * render.
 */
export function createTermsUrl(appUrl: string, languageTag: string): string {
  const language = languageTag.startsWith('el') ? 'el' : 'en';

  return new URL(`/${language}/terms`, appUrl).href;
}

function isAbsoluteUrl(value: string | undefined): value is string {
  if (value === undefined || value === '') return false;

  try {
    new URL(value);
    return true;
  } catch {
    return false;
  }
}
