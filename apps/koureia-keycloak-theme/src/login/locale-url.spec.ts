import { describe, expect, it } from 'vitest';
import { withKcLocale } from './locale-url';

// Root-relative, which is the shape every URL on `kcContext.url` arrives in.
const RESET_URL =
  '/realms/koureia/login-actions/reset-credentials?client_id=koureia-spa&tab_id=abc';

const paramsOf = (url: string) => new URLSearchParams(url.split('?')[1]);

describe('kc_locale on a login-actions URL', () => {
  it('pins a root-relative URL without needing a base', () => {
    const params = paramsOf(withKcLocale(RESET_URL, 'el'));

    expect(params.get('kc_locale')).toBe('el');
    expect(params.get('client_id')).toBe('koureia-spa');
    expect(params.get('tab_id')).toBe('abc');
  });

  it('keeps the path', () => {
    expect(withKcLocale(RESET_URL, 'el')).toContain(
      '/realms/koureia/login-actions/reset-credentials?',
    );
  });

  it('pins an absolute URL too', () => {
    const pinned = withKcLocale('http://localhost:7030/realms/koureia/x', 'en');

    expect(pinned).toBe('http://localhost:7030/realms/koureia/x?kc_locale=en');
  });

  it('adds the parameter to a URL that carries none', () => {
    expect(withKcLocale('/realms/koureia/x', 'en')).toBe('/realms/koureia/x?kc_locale=en');
  });

  it('replaces a locale that is already there rather than adding a second one', () => {
    expect(paramsOf(withKcLocale(`${RESET_URL}&kc_locale=en`, 'el')).getAll('kc_locale')).toEqual([
      'el',
    ]);
  });

  it('preserves a base64 parameter across the round trip', () => {
    const clientData = 'eyJydSI6Imh0dHA6Ly9sb2NhbGhvc3Q6NjEwMC8ifQ==';
    const pinned = withKcLocale(`${RESET_URL}&client_data=${clientData}`, 'el');

    expect(paramsOf(pinned).get('client_data')).toBe(clientData);
  });

  it('keeps a fragment at the end, where it belongs', () => {
    expect(withKcLocale('/realms/koureia/x?a=1#section', 'el')).toBe(
      '/realms/koureia/x?a=1&kc_locale=el#section',
    );
  });

  it('leaves the URL alone when there is no language to pin it to', () => {
    expect(withKcLocale(RESET_URL, '')).toBe(RESET_URL);
  });
});
