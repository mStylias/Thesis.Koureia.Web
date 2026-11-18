import { describe, expect, it } from 'vitest';
import { isApiUrl } from './api-url';

describe('isApiUrl', () => {
  const base = 'http://localhost:7000';

  it('matches the base URL itself and anything beneath it', () => {
    expect(isApiUrl(base, base)).toBe(true);
    expect(isApiUrl(`${base}/api/v1/users/me`, base)).toBe(true);
  });

  it('tolerates a trailing slash on the configured base', () => {
    expect(isApiUrl(`${base}/api/v1/users/me`, `${base}/`)).toBe(true);
  });

  it('rejects a host that merely starts with the base', () => {
    // Why the boundary check exists: a prefix match attaches tokens to this host.
    expect(isApiUrl('http://localhost:7000.evil.test/api/v1/users/me', base)).toBe(false);
  });

  it('rejects Keycloak, which the app also calls', () => {
    expect(
      isApiUrl('http://localhost:7030/realms/koureia/protocol/openid-connect/token', base),
    ).toBe(false);
  });

  describe('with no configured base (same-origin deployment)', () => {
    it('treats a relative /api/ URL as ours', () => {
      expect(isApiUrl('/api/v1/users/me', '')).toBe(true);
      expect(isApiUrl('/api/v1/users/me', undefined)).toBe(true);
    });

    it("rejects the app's own server routes", () => {
      // `/auth/token` counted as an API call once, and then waited for a token from itself.
      expect(isApiUrl('/auth/token', '')).toBe(false);
      expect(isApiUrl('/auth/session', '')).toBe(false);
      expect(isApiUrl('/i18n/el.json', '')).toBe(false);
      expect(isApiUrl('/apix/v1/users/me', '')).toBe(false);
    });

    it("treats an absolute or protocol-relative URL as somebody else's", () => {
      expect(isApiUrl('https://accounts.google.com/o/oauth2/v2/auth', '')).toBe(false);
      expect(isApiUrl('//cdn.example.test/thing.json', '')).toBe(false);
    });
  });
});
