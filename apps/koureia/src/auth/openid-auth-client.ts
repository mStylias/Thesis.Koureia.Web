import {
  IDToken,
  ResponseBodyError,
  TokenEndpointResponse,
  TokenEndpointResponseHelpers,
  allowInsecureRequests,
  authorizationCodeGrant,
  buildAuthorizationUrl,
  calculatePKCECodeChallenge,
  ClientSecretPost,
  Configuration,
  discovery,
  enableNonRepudiationChecks,
  randomNonce,
  randomPKCECodeVerifier,
  randomState,
  refreshTokenGrant,
} from 'openid-client';

import { AuthorizationFlow } from './flow-cookie';
import type { AuthorizationKind } from './openid-auth-client.types';
import { SessionCookieConfig, SessionPayload } from './session-cookie';

const CLIENT_ID = 'koureia-bff';
const AUTH_ENDPOINT_PATH = '/protocol/openid-connect/auth';
const REGISTRATION_ENDPOINT_PATH = '/protocol/openid-connect/registrations';
const UPDATE_PASSWORD_ACTION = 'UPDATE_PASSWORD';

type Environment = Readonly<Record<string, string | undefined>>;
type ValidatedTokenResponse = TokenEndpointResponse & TokenEndpointResponseHelpers;

export interface AuthServerConfig {
  readonly issuer: URL;
  readonly clientSecret: string;
  readonly redirectUri: URL;
  readonly origin: string;
  readonly sessionCookie: SessionCookieConfig;
}

export interface AuthorizationStart {
  readonly flow: AuthorizationFlow;
  readonly redirectUrl: URL;
}

export interface AuthProtocolClient {
  readonly start: (
    kind: AuthorizationKind,
    returnUrl: string,
    uiLocale?: string,
  ) => Promise<AuthorizationStart>;
  readonly exchange: (callbackUrl: URL, flow: AuthorizationFlow) => Promise<SessionPayload>;
  readonly refresh: (session: SessionPayload) => Promise<SessionPayload>;
  readonly logout: (refreshToken: string) => Promise<void>;
}

export function loadAuthServerConfig(environment: Environment): AuthServerConfig {
  const issuer = readUrl(environment['KOUREIA_BFF_ISSUER'], 'KOUREIA_BFF_ISSUER');
  const redirectUri = readUrl(environment['KOUREIA_BFF_REDIRECT_URI'], 'KOUREIA_BFF_REDIRECT_URI');
  const clientSecret = readRequired(
    environment['KOUREIA_BFF_CLIENT_SECRET'],
    'KOUREIA_BFF_CLIENT_SECRET',
  );

  assertOidcUrl(issuer, 'KOUREIA_BFF_ISSUER');
  assertRedirectUri(redirectUri);

  const secure = redirectUri.protocol === 'https:';
  return {
    issuer,
    clientSecret,
    redirectUri,
    origin: redirectUri.origin,
    sessionCookie: secure ? { name: '__Host-ks', secure: true } : { name: 'ks', secure: false },
  };
}

export function createOpenIdAuthClient(config: AuthServerConfig): AuthProtocolClient {
  let configuration: Promise<Configuration> | undefined;

  const getConfiguration = (): Promise<Configuration> => {
    const extensions = [enableNonRepudiationChecks];
    if (config.issuer.protocol === 'http:') {
      // oxlint-disable-next-line @typescript-eslint/no-deprecated -- Local Keycloak uses HTTP.
      extensions.push(allowInsecureRequests);
    }
    configuration ??= discovery(
      config.issuer,
      CLIENT_ID,
      undefined,
      ClientSecretPost(config.clientSecret),
      {
        execute: extensions,
        timeout: 10,
      },
    ).catch((error: unknown) => {
      configuration = undefined;
      throw error;
    });
    return configuration;
  };

  return {
    async start(kind, returnUrl, uiLocale) {
      const oidc = await getConfiguration();
      const codeVerifier = randomPKCECodeVerifier();
      const state = randomState();
      const nonce = randomNonce();
      const codeChallenge = await calculatePKCECodeChallenge(codeVerifier);
      const parameters: Record<string, string> = {
        redirect_uri: config.redirectUri.href,
        scope: 'openid',
        code_challenge: codeChallenge,
        code_challenge_method: 'S256',
        state,
        nonce,
      };
      if (uiLocale !== undefined) parameters['ui_locales'] = uiLocale;

      const authorizationUrl = buildAuthorizationUrl(oidc, parameters);
      return {
        flow: { v: 1, cv: codeVerifier, state, nonce, returnUrl },
        redirectUrl: toAuthorizationRedirect(kind, authorizationUrl),
      };
    },

    async exchange(callbackUrl, flow) {
      const oidc = await getConfiguration();
      const tokens = await authorizationCodeGrant(oidc, callbackUrl, {
        expectedNonce: flow.nonce,
        expectedState: flow.state,
        pkceCodeVerifier: flow.cv,
      });
      return toSessionPayload(tokens);
    },

    async refresh(session) {
      const oidc = await getConfiguration();
      const tokens = await refreshTokenGrant(oidc, session.rt);
      return toSessionPayload(tokens, session);
    },

    async logout(refreshToken) {
      const oidc = await getConfiguration();
      const endpoint = oidc.serverMetadata().end_session_endpoint;
      if (endpoint === undefined) throw new Error('The provider has no logout endpoint.');

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: CLIENT_ID,
          client_secret: config.clientSecret,
          refresh_token: refreshToken,
        }),
        signal: AbortSignal.timeout(10_000),
      });
      if (!response.ok) {
        throw new AuthProviderError('The provider rejected sign-out.', response.status);
      }
    },
  };
}

export function describeProviderError(error: unknown): Readonly<Record<string, unknown>> {
  if (error instanceof ResponseBodyError) {
    return {
      name: error.name,
      status: error.status,
      error: error.error,
      description: error.error_description,
    };
  }
  if (error instanceof AuthProviderError) {
    return { name: error.name, status: error.status, message: error.message };
  }
  if (error instanceof Error) return { name: error.name, message: error.message };
  return { name: 'UnknownError' };
}

class AuthProviderError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = 'AuthProviderError';
  }
}

function toSessionPayload(
  tokens: ValidatedTokenResponse,
  previous?: SessionPayload,
): SessionPayload {
  const expiresIn = tokens.expiresIn();
  if (expiresIn === undefined || !Number.isFinite(expiresIn) || expiresIn <= 0) {
    throw new Error('The provider returned no usable access-token expiry.');
  }

  const refreshToken = tokens.refresh_token ?? previous?.rt;
  if (refreshToken === undefined || refreshToken === '') {
    throw new Error('The provider returned no refresh token.');
  }

  const claims = tokens.claims();
  if (previous === undefined && claims === undefined) {
    throw new Error('The provider returned no ID token.');
  }

  return {
    v: 1,
    rt: refreshToken,
    at: tokens.access_token,
    exp: Math.floor(Date.now() / 1000) + Math.ceil(expiresIn),
    sub: readSubject(claims, previous),
    email: readStringClaim(claims, 'email') ?? previous?.email ?? '',
    ev: readBooleanClaim(claims, 'email_verified') ?? previous?.ev ?? false,
    gn: readStringClaim(claims, 'given_name') ?? previous?.gn ?? '',
    fn: readStringClaim(claims, 'family_name') ?? previous?.fn ?? '',
    loc: readStringClaim(claims, 'locale') ?? previous?.loc ?? '',
  };
}

function readSubject(claims: IDToken | undefined, previous?: SessionPayload): string {
  const subject = claims?.sub ?? previous?.sub;
  if (subject === undefined || subject === '') {
    throw new Error('The provider returned no subject claim.');
  }
  return subject;
}

function readStringClaim(claims: IDToken | undefined, name: string): string | undefined {
  const value = claims?.[name];
  return typeof value === 'string' ? value : undefined;
}

function readBooleanClaim(claims: IDToken | undefined, name: string): boolean | undefined {
  const value = claims?.[name];
  return typeof value === 'boolean' ? value : undefined;
}

/** Where to send the browser for one kind of start. All kinds share state, PKCE and nonce. */
export function toAuthorizationRedirect(kind: AuthorizationKind, authorizationUrl: URL): URL {
  if (kind === 'sign-up') return toRegistrationUrl(authorizationUrl);
  if (kind === 'sign-in') return authorizationUrl;

  const actionUrl = new URL(authorizationUrl);
  actionUrl.searchParams.set('kc_action', UPDATE_PASSWORD_ACTION);
  return actionUrl;
}

export function toRegistrationUrl(authorizationUrl: URL): URL {
  const registrationUrl = new URL(authorizationUrl);
  if (!registrationUrl.pathname.endsWith(AUTH_ENDPOINT_PATH)) return registrationUrl;

  registrationUrl.pathname = `${registrationUrl.pathname.slice(0, -AUTH_ENDPOINT_PATH.length)}${REGISTRATION_ENDPOINT_PATH}`;
  return registrationUrl;
}

function readRequired(value: string | undefined, name: string): string {
  if (value === undefined || value === '') throw new Error(`${name} must be set.`);
  return value;
}

function readUrl(value: string | undefined, name: string): URL {
  const raw = readRequired(value, name);
  try {
    return new URL(raw);
  } catch {
    throw new Error(`${name} must be an absolute URL.`);
  }
}

function assertOidcUrl(url: URL, name: string): void {
  if (url.protocol === 'https:') return;
  if (url.protocol === 'http:' && isLoopback(url.hostname)) return;
  throw new Error(`${name} must use HTTPS outside local development.`);
}

function assertRedirectUri(url: URL): void {
  assertOidcUrl(url, 'KOUREIA_BFF_REDIRECT_URI');
  if (url.pathname !== '/auth/callback' || url.search !== '' || url.hash !== '') {
    throw new Error('KOUREIA_BFF_REDIRECT_URI must end with the exact /auth/callback path.');
  }
}

function isLoopback(hostname: string): boolean {
  return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '[::1]';
}
