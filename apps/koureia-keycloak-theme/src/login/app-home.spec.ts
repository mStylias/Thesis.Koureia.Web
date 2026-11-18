import { describe, expect, it } from 'vitest';
import { kcEnvDefaults } from '../kc.gen';
import { appBaseUrl, createTermsUrl } from './app-home';
import type { KcContext } from './KcContext';

function properties(value: unknown): KcContext['properties'] {
  return { KOUREIA_APP_URL: value } as KcContext['properties'];
}

describe('appBaseUrl', () => {
  it('uses the configured site URL', () => {
    expect(appBaseUrl(properties('https://koureia.gr'))).toBe('https://koureia.gr');
  });

  // The frame resolves this on every page and `new URL` throws on an empty base, so an unset
  // variable blanks every authentication screen instead of one wordmark link.
  it('falls back to the build-time default when the variable never arrived', () => {
    expect(appBaseUrl(properties(''))).toBe(kcEnvDefaults.KOUREIA_APP_URL);
    expect(appBaseUrl(properties(undefined))).toBe(kcEnvDefaults.KOUREIA_APP_URL);
  });

  it('falls back when the value is not absolute, which cannot be resolved against', () => {
    expect(appBaseUrl(properties('/koureia'))).toBe(kcEnvDefaults.KOUREIA_APP_URL);
    expect(appBaseUrl(properties('koureia.gr'))).toBe(kcEnvDefaults.KOUREIA_APP_URL);
  });

  it('leaves a usable base behind, whatever it was handed', () => {
    for (const value of ['', undefined, 'nonsense', 'https://koureia.gr']) {
      expect(() => new URL('/el/', appBaseUrl(properties(value)))).not.toThrow();
    }
  });
});

describe('createTermsUrl', () => {
  it('creates a language-specific application terms URL', () => {
    expect(createTermsUrl('https://koureia.gr', 'el')).toBe('https://koureia.gr/el/terms');
    expect(createTermsUrl('https://koureia.gr', 'en-US')).toBe('https://koureia.gr/en/terms');
  });
});
