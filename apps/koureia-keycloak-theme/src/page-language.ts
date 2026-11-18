import type { KcContext } from './kc.gen';

/**
 * The language Keycloak rendered this page in, for `<html lang>`.
 *
 * Keycloakify copies `index.html` into every generated `*.ftl`, so a `lang` written there is
 * the language every page claims. Only Keycloak knows the real one, so correct it at runtime.
 * `locale` is absent when the realm turns internationalization off, and Keycloak then renders
 * English.
 */
export function pageLanguageTag(kcContext: KcContext | undefined): string {
  const languageTag = kcContext?.locale?.currentLanguageTag;

  return languageTag === undefined || languageTag === '' ? 'en' : languageTag;
}

/** The same tag, narrowed to the two languages this theme writes copy for. */
export function themeLanguage(kcContext: KcContext | undefined): 'el' | 'en' {
  return pageLanguageTag(kcContext).startsWith('el') ? 'el' : 'en';
}
