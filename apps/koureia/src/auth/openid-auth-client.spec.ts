import {
  loadAuthServerConfig,
  toAuthorizationRedirect,
  toRegistrationUrl,
} from './openid-auth-client';

describe('auth server configuration', () => {
  it('loads the local issuer, secret, redirect, and development cookie mode', () => {
    const config = loadAuthServerConfig({
      KOUREIA_BFF_ISSUER: 'http://localhost:7030/realms/koureia',
      KOUREIA_BFF_CLIENT_SECRET: 'secret',
      KOUREIA_BFF_REDIRECT_URI: 'http://localhost:6100/auth/callback',
    });

    expect(config.issuer.href).toBe('http://localhost:7030/realms/koureia');
    expect(config.origin).toBe('http://localhost:6100');
    expect(config.sessionCookie).toEqual({ name: 'ks', secure: false });
  });

  it('selects the __Host cookie for an HTTPS redirect', () => {
    const config = loadAuthServerConfig({
      KOUREIA_BFF_ISSUER: 'https://auth.example/realms/koureia',
      KOUREIA_BFF_CLIENT_SECRET: 'secret',
      KOUREIA_BFF_REDIRECT_URI: 'https://app.example/auth/callback',
    });

    expect(config.sessionCookie).toEqual({ name: '__Host-ks', secure: true });
  });

  it.each([
    [{}, 'KOUREIA_BFF_ISSUER must be set.'],
    [
      {
        KOUREIA_BFF_ISSUER: 'http://auth.example/realms/koureia',
        KOUREIA_BFF_CLIENT_SECRET: 'secret',
        KOUREIA_BFF_REDIRECT_URI: 'https://app.example/auth/callback',
      },
      'KOUREIA_BFF_ISSUER must use HTTPS outside local development.',
    ],
    [
      {
        KOUREIA_BFF_ISSUER: 'https://auth.example/realms/koureia',
        KOUREIA_BFF_CLIENT_SECRET: 'secret',
        KOUREIA_BFF_REDIRECT_URI: 'https://app.example/other',
      },
      'KOUREIA_BFF_REDIRECT_URI must end with the exact /auth/callback path.',
    ],
  ])('rejects invalid server configuration', (environment, message) => {
    expect(() => loadAuthServerConfig(environment)).toThrow(message);
  });
});

describe('registration URL', () => {
  it('changes only the authorization endpoint path', () => {
    const authorization = new URL(
      'http://localhost:7030/realms/koureia/protocol/openid-connect/auth?redirect_uri=http%3A%2F%2Flocalhost%3A6100%2Fauth%2Fcallback&state=state',
    );

    const registration = toRegistrationUrl(authorization);

    expect(registration.pathname).toBe('/realms/koureia/protocol/openid-connect/registrations');
    expect(registration.search).toBe(authorization.search);
  });

  it('leaves an unknown endpoint unchanged', () => {
    const token = new URL('http://localhost:7030/realms/koureia/protocol/openid-connect/token?a=1');

    expect(toRegistrationUrl(token).href).toBe(token.href);
  });
});

describe('authorization redirect', () => {
  const authorization = new URL(
    'http://localhost:7030/realms/koureia/protocol/openid-connect/auth?redirect_uri=http%3A%2F%2Flocalhost%3A6100%2Fauth%2Fcallback&state=state&nonce=nonce&code_challenge=challenge&code_challenge_method=S256',
  );

  it('asks Keycloak for the password action on the same authorization request', () => {
    const redirect = toAuthorizationRedirect('update-password', authorization);

    expect(redirect.pathname).toBe('/realms/koureia/protocol/openid-connect/auth');
    expect(redirect.searchParams.get('kc_action')).toBe('UPDATE_PASSWORD');
    for (const [name, value] of authorization.searchParams) {
      expect(redirect.searchParams.get(name)).toBe(value);
    }
  });

  it('leaves sign-in unchanged and sends sign-up to registration', () => {
    const registration = toAuthorizationRedirect('sign-up', authorization);

    expect(toAuthorizationRedirect('sign-in', authorization).href).toBe(authorization.href);
    expect(registration.pathname).toBe('/realms/koureia/protocol/openid-connect/registrations');
    expect(registration.searchParams.has('kc_action')).toBe(false);
  });
});
