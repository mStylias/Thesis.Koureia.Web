import { describe, expect, it } from 'vitest';
import { themeAssetUrl } from './theme-assets';

describe('themeAssetUrl', () => {
  it('resolves public assets through the Keycloak theme resources path', () => {
    expect(themeAssetUrl('/resources/theme/koureia/login', '/images/hero.webp')).toBe(
      '/resources/theme/koureia/login/dist/images/hero.webp',
    );
  });

  it('normalizes boundary slashes', () => {
    expect(themeAssetUrl('/resources/theme/koureia/login/', 'brand/logo.png')).toBe(
      '/resources/theme/koureia/login/dist/brand/logo.png',
    );
  });
});
