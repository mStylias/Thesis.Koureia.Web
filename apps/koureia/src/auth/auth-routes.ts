import { timingSafeEqual } from 'node:crypto';

import { Response, Router, json } from 'express';
import { AppLanguage, DEFAULT_APP_LANGUAGE, toAppLanguage } from '@util/language';

import {
  AuthorizationFlow,
  FlowCookieConfig,
  clearFlowCookieHeader,
  createFlowCookieHeader,
  readFlowCookie,
  sealAuthorizationFlow,
  unsealAuthorizationFlow,
} from './flow-cookie';
import { clearLanguageCookieHeader, clearUiLanguageCookieHeader } from '../language-routes';
import type { ApplicationActionStatus } from './auth-routes.types';
import { AuthProtocolClient, describeProviderError } from './openid-auth-client';
import type { AuthorizationKind } from './openid-auth-client.types';
import {
  InvalidSessionCookieError,
  SessionCookieConfig,
  SessionCookieKeyring,
  SessionPayload,
  clearSessionCookieHeaders,
  createSessionCookieHeaders,
  readSessionCookie,
  sealSession,
  unsealSession,
} from './session-cookie';

const LANDING_PATH = '/';
const REFRESH_WINDOW_SECONDS = 30;
const VERIFY_EMAIL_PATH = 'verify-email';
const ACTION_STATUS_PARAMETER = 'kc_action_status';
const ACTION_STATUSES: ReadonlySet<string> = new Set(['success', 'cancelled', 'error']);

export interface AuthRouteDependencies {
  readonly protocol: AuthProtocolClient;
  readonly keyring: SessionCookieKeyring;
  readonly sessionCookie: SessionCookieConfig;
  readonly origin: string;
  readonly now?: () => number;
  readonly logger?: Pick<Console, 'error'>;
}

export function createAuthRouter(dependencies: AuthRouteDependencies): Router {
  const router = Router();
  const flowCookie: FlowCookieConfig = dependencies.sessionCookie.secure
    ? { name: '__Host-ksf', secure: true }
    : { name: 'ksf', secure: false };
  const now = dependencies.now ?? (() => Math.floor(Date.now() / 1000));
  const logger = dependencies.logger ?? console;

  router.use((_request, response, next) => {
    response.setHeader('Cache-Control', 'no-store');
    // These are reachable and useless in an index. Stated as a header because most of
    // what this router returns is a redirect, which has no head to put a meta tag in.
    response.setHeader('X-Robots-Tag', 'noindex');
    next();
  });

  router.get('/sign-in', async (request, response) => {
    await startAuthorization('sign-in', request.query['returnUrl'], response);
  });

  router.get('/sign-up', async (request, response) => {
    await startAuthorization('sign-up', request.query['returnUrl'], response);
  });

  /**
   * Opens the themed Keycloak page for a new password. Keycloak asks for a sign-in first when
   * there is no session, and the callback returns the outcome as `kc_action_status`.
   */
  router.get('/account/password', async (request, response) => {
    // Falls back instead of refusing like sign-in: the action itself does not depend on it.
    const returnUrl = parseReturnUrl(request.query['returnUrl'], dependencies.origin) ?? '/';
    await authorize('update-password', returnUrl, response);
  });

  router.get('/callback', async (request, response) => {
    const cookieHeader = request.headers.cookie;
    const clearFlow = clearFlowCookieHeader(flowCookie);
    const flow = readAuthorizationFlow(cookieHeader, flowCookie, dependencies.keyring);
    if (flow === null || !matchesState(flow.state, request.query['state'])) {
      response.setHeader('Set-Cookie', clearFlow);
      sendErrorPage(
        response,
        400,
        'This sign-in link is no longer valid',
        'Start sign-in again from the page you want to visit.',
      );
      return;
    }

    const providerError = readQueryString(request.query['error']);
    const actionStatus = readActionStatus(request.query[ACTION_STATUS_PARAMETER]);
    const returnUrl =
      actionStatus === undefined
        ? flow.returnUrl
        : withActionStatus(flow.returnUrl, actionStatus, dependencies.origin);
    // A cancelled or failed action can arrive without a code. The existing session stays valid.
    if (
      actionStatus !== undefined &&
      (providerError !== undefined || readQueryString(request.query['code']) === undefined)
    ) {
      response.setHeader('Set-Cookie', clearFlow);
      response.redirect(302, returnUrl);
      return;
    }

    if (providerError !== undefined) {
      response.setHeader('Set-Cookie', [
        clearFlow,
        ...clearSessionCookieHeaders(dependencies.sessionCookie, cookieHeader),
      ]);
      if (providerError === 'login_required') {
        response.redirect(302, flow.returnUrl);
        return;
      }
      if (providerError === 'access_denied') {
        response.redirect(302, LANDING_PATH);
        return;
      }

      sendErrorPage(
        response,
        400,
        'Sign-in did not finish',
        'Return to the site and start sign-in again.',
      );
      return;
    }

    try {
      const callbackUrl = new URL(request.originalUrl, dependencies.origin);
      const session = await dependencies.protocol.exchange(callbackUrl, flow);
      const sealed = sealSession(session, dependencies.keyring);
      response.setHeader('Set-Cookie', [
        ...createSessionCookieHeaders(sealed, dependencies.sessionCookie, cookieHeader),
        clearFlow,
      ]);
      // An unverified address cannot reach a single API endpoint except the two that fix it, so
      // the person goes to verification now rather than to a page that will only refuse them.
      // Decided here because this is the one moment the fresh claims and the intended
      // destination are both in hand.
      response.redirect(302, session.ev ? returnUrl : verificationUrl(returnUrl, session));
    } catch (error) {
      logger.error('[auth] token exchange failed', describeProviderError(error));
      response.setHeader('Set-Cookie', clearFlow);
      // Keycloak already finished the action. Report its outcome on the old session.
      if (actionStatus !== undefined) {
        response.redirect(302, returnUrl);
        return;
      }
      sendErrorPage(
        response,
        502,
        'Sign-in is temporarily unavailable',
        'Try again in a few minutes.',
      );
    }
  });

  router.get('/session', (request, response) => {
    const result = readSession(
      request.headers.cookie,
      dependencies.sessionCookie,
      dependencies.keyring,
    );
    if (result.session === null) {
      if (result.invalid) {
        response.setHeader(
          'Set-Cookie',
          clearSessionCookieHeaders(dependencies.sessionCookie, request.headers.cookie),
        );
      }
      response.json({ signedIn: false, claims: null });
      return;
    }

    response.json({ signedIn: true, claims: toPublicClaims(result.session) });
  });

  router.get('/token', async (request, response) => {
    const cookieHeader = request.headers.cookie;
    const result = readSession(cookieHeader, dependencies.sessionCookie, dependencies.keyring);
    if (result.session === null) {
      expireSession(response, dependencies.sessionCookie, cookieHeader);
      return;
    }

    let session = result.session;
    if (session.exp <= now() + REFRESH_WINDOW_SECONDS) {
      try {
        session = await dependencies.protocol.refresh(session);
        const sealed = sealSession(session, dependencies.keyring);
        response.setHeader(
          'Set-Cookie',
          createSessionCookieHeaders(sealed, dependencies.sessionCookie, cookieHeader),
        );
      } catch (error) {
        logger.error('[auth] token refresh failed', describeProviderError(error));
        expireSession(response, dependencies.sessionCookie, cookieHeader);
        return;
      }
    }

    response.json({ accessToken: session.at, expiresAt: session.exp });
  });

  /**
   * Exchanges the token set now instead of at the normal expiry window, and answers with the
   * claims it produced.
   *
   * Verification is why this exists: proving an address in Keycloak cannot alter a token that is
   * already signed, so the session keeps saying `email_verified: false` until it is replaced.
   * The response carries no access token — the browser still gets those from `/auth/token` only.
   */
  router.post('/refresh', async (request, response) => {
    if (request.get('Origin') !== dependencies.origin) {
      response.status(403).json({ reason: 'origin-not-allowed' });
      return;
    }

    const cookieHeader = request.headers.cookie;
    const result = readSession(cookieHeader, dependencies.sessionCookie, dependencies.keyring);
    if (result.session === null) {
      expireSession(response, dependencies.sessionCookie, cookieHeader);
      return;
    }

    try {
      const session = await dependencies.protocol.refresh(result.session);
      const sealed = sealSession(session, dependencies.keyring);
      response.setHeader(
        'Set-Cookie',
        createSessionCookieHeaders(sealed, dependencies.sessionCookie, cookieHeader),
      );
      response.json({
        signedIn: true,
        claims: toPublicClaims(session),
        expiresAt: session.exp,
      });
    } catch (error) {
      logger.error('[auth] forced refresh failed', describeProviderError(error));
      expireSession(response, dependencies.sessionCookie, cookieHeader);
    }
  });

  /**
   * Re-seals the session with the language the person just stored on their profile.
   *
   * `loc` is sealed into the session cookie at sign-in and is the first thing `chooseLanguage`
   * reads, above the preference cookie and above Greek. The profile is the store of record, but
   * the copy of it that reaches Keycloak is staged through the API's outbox and the claim only
   * follows on the next token refresh — so a signed-in visitor who switched language was sent
   * back to the old one by the next visit to `/`. This closes that window.
   *
   * It rewrites one display claim in a payload this server sealed itself. It grants nothing:
   * the tokens, the subject and `ev` are copied across untouched, and the next refresh takes
   * `loc` from the provider again, by which time the outbox has landed.
   *
   * `json()` is mounted on this route alone. Nothing else in this router reads a body, and a
   * parser on the whole app would sit in front of the Angular handler as well.
   */
  router.post('/language', json({ limit: '1kb' }), (request, response) => {
    if (request.get('Origin') !== dependencies.origin) {
      response.status(403).json({ reason: 'origin-not-allowed' });
      return;
    }

    const language = toAppLanguage(readLanguageField(request.body));
    if (language === null) {
      response.status(400).json({ reason: 'unsupported-language' });
      return;
    }

    const cookieHeader = request.headers.cookie;
    const result = readSession(cookieHeader, dependencies.sessionCookie, dependencies.keyring);
    if (result.session === null) {
      expireSession(response, dependencies.sessionCookie, cookieHeader);
      return;
    }

    // Already agreed. Re-sealing would spend a cookie write and rotate the ciphertext for nothing.
    if (result.session.loc !== language) {
      const sealed = sealSession({ ...result.session, loc: language }, dependencies.keyring);
      response.setHeader(
        'Set-Cookie',
        createSessionCookieHeaders(sealed, dependencies.sessionCookie, cookieHeader),
      );
    }

    response.json({ locale: language });
  });

  router.post('/sign-out', async (request, response) => {
    if (request.get('Origin') !== dependencies.origin) {
      response.status(403).json({ reason: 'origin-not-allowed' });
      return;
    }

    const cookieHeader = request.headers.cookie;
    const result = readSession(cookieHeader, dependencies.sessionCookie, dependencies.keyring);
    const clearCookies = [
      ...clearSessionCookieHeaders(dependencies.sessionCookie, cookieHeader),
      clearFlowCookieHeader(flowCookie),
      // A shop tablet that three barbers sign in and out of all day: without this, the
      // second one inherits the first one's language (§1.4). It is the same
      // shared-computer thread that made sign-out back-channel rather than local.
      clearLanguageCookieHeader(dependencies.sessionCookie.secure),
      clearUiLanguageCookieHeader(dependencies.sessionCookie.secure),
    ];

    if (result.session !== null) {
      try {
        await dependencies.protocol.logout(result.session.rt);
      } catch (error) {
        logger.error('[auth] back-channel sign-out failed', describeProviderError(error));
        response.setHeader('Set-Cookie', clearCookies);
        response.status(502).json({ redirectTo: LANDING_PATH, reason: 'provider-unavailable' });
        return;
      }
    }

    response.setHeader('Set-Cookie', clearCookies);
    response.json({ redirectTo: LANDING_PATH });
  });

  router.get('/signed-out', (_request, response) => {
    response.redirect(302, LANDING_PATH);
  });

  return router;

  async function startAuthorization(
    kind: AuthorizationKind,
    requestedReturnUrl: unknown,
    response: Response,
  ): Promise<void> {
    const returnUrl = parseReturnUrl(requestedReturnUrl, dependencies.origin);
    if (returnUrl === null) {
      sendErrorPage(
        response,
        400,
        'The return address is invalid',
        'Return to the site and start sign-in again.',
      );
      return;
    }

    await authorize(kind, returnUrl, response);
  }

  async function authorize(
    kind: AuthorizationKind,
    returnUrl: string,
    response: Response,
  ): Promise<void> {
    try {
      const start = await dependencies.protocol.start(kind, returnUrl, readUiLocale(returnUrl));
      const sealed = sealAuthorizationFlow(start.flow, dependencies.keyring);
      response.setHeader('Set-Cookie', createFlowCookieHeader(sealed, flowCookie));
      response.redirect(302, start.redirectUrl.href);
    } catch (error) {
      logger.error('[auth] authorization request failed', describeProviderError(error));
      sendErrorPage(
        response,
        502,
        'Sign-in is temporarily unavailable',
        'Try again in a few minutes.',
      );
    }
  }
}

export interface SessionReadResult {
  readonly session: SessionPayload | null;
  readonly invalid: boolean;
}

function readAuthorizationFlow(
  cookieHeader: string | undefined,
  config: FlowCookieConfig,
  keyring: SessionCookieKeyring,
): AuthorizationFlow | null {
  const sealed = readFlowCookie(cookieHeader, config);
  return sealed === null ? null : unsealAuthorizationFlow(sealed, keyring);
}

export function readSession(
  cookieHeader: string | undefined,
  config: SessionCookieConfig,
  keyring: SessionCookieKeyring,
): SessionReadResult {
  const sealed = readSessionCookie(cookieHeader, config);
  if (sealed === null)
    return { session: null, invalid: hasSessionCookie(cookieHeader, config.name) };

  try {
    return { session: unsealSession(sealed, keyring), invalid: false };
  } catch (error) {
    if (error instanceof InvalidSessionCookieError) return { session: null, invalid: true };
    throw error;
  }
}

function expireSession(
  response: Response,
  config: SessionCookieConfig,
  cookieHeader: string | undefined,
): void {
  response.setHeader('Set-Cookie', clearSessionCookieHeaders(config, cookieHeader));
  response.status(401).json({ reason: 'session-expired' });
}

function toPublicClaims(session: SessionPayload): Readonly<Record<string, unknown>> {
  return {
    sub: session.sub,
    email: session.email,
    emailVerified: session.ev,
    givenName: session.gn,
    familyName: session.fn,
    locale: session.loc,
  };
}

function parseReturnUrl(value: unknown, origin: string): string | null {
  if (value === undefined) return '/';
  if (typeof value !== 'string' || !value.startsWith('/') || value.startsWith('//')) return null;
  if (value.includes('\\') || value.includes('\0')) return null;

  try {
    const url = new URL(value, origin);
    return url.origin === origin ? `${url.pathname}${url.search}${url.hash}` : null;
  } catch {
    return null;
  }
}

function readActionStatus(value: unknown): ApplicationActionStatus | undefined {
  return typeof value === 'string' && ACTION_STATUSES.has(value)
    ? (value as ApplicationActionStatus)
    : undefined;
}

function withActionStatus(
  returnUrl: string,
  status: ApplicationActionStatus,
  origin: string,
): string {
  const url = new URL(returnUrl, origin);
  url.searchParams.set(ACTION_STATUS_PARAMETER, status);
  return `${url.pathname}${url.search}${url.hash}`;
}

function readUiLocale(returnUrl: string): string | undefined {
  const segment = returnUrl.split('/', 3)[1];
  return segment === 'el' || segment === 'en' ? segment : undefined;
}

/**
 * The verification page, carrying where the person was going. The language comes from the
 * destination first and the account second, because a person who asked for `/en/…` asked in
 * English whatever their stored preference says.
 */
function verificationUrl(returnUrl: string, session: SessionPayload): string {
  const language: AppLanguage =
    toAppLanguage(readUiLocale(returnUrl)) ?? toAppLanguage(session.loc) ?? DEFAULT_APP_LANGUAGE;
  // Signing in again on an account that is still unverified would otherwise nest the page inside
  // itself, and every repeat would add another layer.
  const target = isVerificationPath(returnUrl) ? `/${language}` : returnUrl;
  return `/${language}/${VERIFY_EMAIL_PATH}?returnUrl=${encodeURIComponent(target)}`;
}

function isVerificationPath(returnUrl: string): boolean {
  const path = returnUrl.split('?', 1)[0];
  return path.split('/').includes(VERIFY_EMAIL_PATH);
}

function matchesState(expected: string, actual: unknown): boolean {
  if (typeof actual !== 'string') return false;
  const expectedBuffer = Buffer.from(expected);
  const actualBuffer = Buffer.from(actual);
  return (
    expectedBuffer.length === actualBuffer.length && timingSafeEqual(expectedBuffer, actualBuffer)
  );
}

/** The `language` of a parsed JSON body, or `null` for a body that is anything else. */
function readLanguageField(body: unknown): string | null {
  if (typeof body !== 'object' || body === null) return null;
  const language = (body as Record<string, unknown>)['language'];
  return typeof language === 'string' ? language : null;
}

function readQueryString(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined;
}

function hasSessionCookie(cookieHeader: string | undefined, name: string): boolean {
  if (cookieHeader === undefined) return false;
  return cookieHeader
    .split(';')
    .some((part) => part.trim().startsWith(`${name}=`) || part.trim().startsWith(`${name}.`));
}

function sendErrorPage(response: Response, status: number, title: string, message: string): void {
  response
    .status(status)
    .type('html')
    .send(
      `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title></head><body><main><h1>${title}</h1><p>${message}</p><p><a href="/">Return to the home page</a></p></main></body></html>`,
    );
}
