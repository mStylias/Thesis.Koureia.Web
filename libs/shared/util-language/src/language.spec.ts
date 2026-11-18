import {
  isAppLanguage,
  languageFromPath,
  swapLanguageInPath,
  toAppLanguage,
  withLanguagePrefix,
} from './language';

describe('isAppLanguage', () => {
  it.each(['el', 'en'])('accepts %s', (value) => {
    expect(isAppLanguage(value)).toBe(true);
  });

  it.each([['el-GR'], ['EL'], ['de'], [''], [null], [undefined], [1]])(
    'refuses %s, which is not a published prefix',
    (value) => {
      expect(isAppLanguage(value)).toBe(false);
    },
  );
});

describe('toAppLanguage', () => {
  it.each([
    ['el', 'el'],
    ['el-GR', 'el'],
    ['EL-gr', 'el'],
    ['  en  ', 'en'],
    ['en-US', 'en'],
  ])('narrows %s to %s', (tag, expected) => {
    expect(toAppLanguage(tag)).toBe(expected);
  });

  it.each([['de'], ['fr-FR'], [''], [null], [undefined]])(
    'returns null for %s rather than defaulting, so callers can tell "no answer" from "Greek"',
    (tag) => {
      expect(toAppLanguage(tag)).toBeNull();
    },
  );
});

describe('languageFromPath', () => {
  it.each([
    ['/el', 'el'],
    ['/el/', 'el'],
    ['/en/barbershops', 'en'],
    ['/el/barbershops/kalamaria', 'el'],
  ])('reads %s as %s', (path, expected) => {
    expect(languageFromPath(path)).toBe(expected);
  });

  it.each([['/'], ['/barbershops'], ['/auth/callback'], ['/de/barbershops']])(
    'finds no language in %s',
    (path) => {
      expect(languageFromPath(path)).toBeNull();
    },
  );
});

describe('withLanguagePrefix', () => {
  it.each([
    ['/', 'el', '/el'],
    ['', 'el', '/el'],
    ['/barbershops', 'en', '/en/barbershops'],
    ['barbershops', 'en', '/en/barbershops'],
  ])('prefixes %s with %s', (path, language, expected) => {
    expect(withLanguagePrefix(path, language as 'el' | 'en')).toBe(expected);
  });
});

describe('swapLanguageInPath', () => {
  it('rewrites the prefix and leaves the shared slug alone — the property §0.2 buys', () => {
    expect(swapLanguageInPath('/el/how-it-works', 'en')).toBe('/en/how-it-works');
  });

  it.each([
    ['/el', 'en', '/en'],
    ['/el/', 'en', '/en'],
    ['/en/barbershops/kalamaria', 'el', '/el/barbershops/kalamaria'],
  ])('swaps %s to %s', (path, language, expected) => {
    expect(swapLanguageInPath(path, language as 'el' | 'en')).toBe(expected);
  });

  it('prefixes a path that has no language yet', () => {
    expect(swapLanguageInPath('/barbershops', 'en')).toBe('/en/barbershops');
  });
});
