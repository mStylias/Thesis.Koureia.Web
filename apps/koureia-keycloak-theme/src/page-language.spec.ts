import { describe, expect, it } from 'vitest';
import type { KcContext } from './kc.gen';
import { pageLanguageTag, themeLanguage } from './page-language';

/** Only `locale` is read, so the rest of the context is not built here. */
function context(languageTag?: string): KcContext {
  return (
    languageTag === undefined ? {} : { locale: { currentLanguageTag: languageTag } }
  ) as KcContext;
}

describe('pageLanguageTag', () => {
  it('reports the tag Keycloak rendered the page in', () => {
    expect(pageLanguageTag(context('el'))).toBe('el');
    expect(pageLanguageTag(context('en'))).toBe('en');
  });

  it('passes a regional tag through untouched, because `lang` accepts one', () => {
    expect(pageLanguageTag(context('pt-BR'))).toBe('pt-BR');
  });

  it('falls back to English when the realm has internationalization switched off', () => {
    // Keycloak omits `locale` then, and renders English.
    expect(pageLanguageTag(context())).toBe('en');
    expect(pageLanguageTag(undefined)).toBe('en');
  });

  it('falls back to English rather than emitting an empty lang attribute', () => {
    expect(pageLanguageTag(context(''))).toBe('en');
  });
});

describe('themeLanguage', () => {
  it('narrows to the two languages the theme writes copy for', () => {
    expect(themeLanguage(context('el'))).toBe('el');
    expect(themeLanguage(context('en'))).toBe('en');
    expect(themeLanguage(context('fr'))).toBe('en');
    expect(themeLanguage(undefined)).toBe('en');
  });
});
