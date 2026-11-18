import { AddressInfo } from 'node:net';
import { Server } from 'node:http';
import { randomBytes } from 'node:crypto';

import express from 'express';

import { createAuthRouter } from './auth-routes';
import { AuthorizationFlow } from './flow-cookie';
import { AuthProtocolClient } from './openid-auth-client';
import type { AuthorizationKind } from './openid-auth-client.types';
import {
  SessionCookieKeyring,
  SessionPayload,
  createSessionCookieHeaders,
  sealSession,
} from './session-cookie';

const ORIGIN = 'http://127.0.0.1';
const NOW = 1_754_745_600;
const keyring: SessionCookieKeyring = { current: randomBytes(32) };
const session: SessionPayload = {
  v: 1,
  rt: 'refresh-token',
  at: 'access-token',
  exp: NOW + 300,
  sub: 'person-1',
  email: 'person@example.com',
  ev: true,
  gn: 'Given',
  fn: 'Family',
  loc: 'el',
};

const servers: Server[] = [];

interface ProtocolMock {
  readonly start: ReturnType<typeof vi.fn<AuthProtocolClient['start']>>;
  readonly exchange: ReturnType<typeof vi.fn<AuthProtocolClient['exchange']>>;
  readonly refresh: ReturnType<typeof vi.fn<AuthProtocolClient['refresh']>>;
  readonly logout: ReturnType<typeof vi.fn<AuthProtocolClient['logout']>>;
}

afterEach(async () => {
  vi.restoreAllMocks();
  await Promise.all(servers.splice(0).map(closeServer));
});

describe('BFF authorization routes', () => {
  it('starts sign-in from a deep link and carries its language', async () => {
    const protocol = createProtocol();
    const baseUrl = await startServer(protocol);

    const response = await fetch(
      `${baseUrl}/auth/sign-in?returnUrl=${encodeURIComponent('/el/barbershops?near=me')}`,
      { redirect: 'manual' },
    );

    expect(response.status).toBe(302);
    expect(response.headers.get('location')).toBe('https://identity.example/authorize');
    expect(protocol.start).toHaveBeenCalledWith('sign-in', '/el/barbershops?near=me', 'el');
    expect(getSetCookies(response)).toContainEqual(
      expect.stringMatching(/^ksf=.*; Max-Age=600; Path=\/; HttpOnly; SameSite=Lax$/),
    );
  });

  it('starts sign-up through the registration flow', async () => {
    const protocol = createProtocol();
    const baseUrl = await startServer(protocol);

    const response = await fetch(`${baseUrl}/auth/sign-up`, { redirect: 'manual' });

    expect(response.status).toBe(302);
    expect(protocol.start).toHaveBeenCalledWith('sign-up', '/', undefined);
  });

  it('rejects an external return URL', async () => {
    const protocol = createProtocol();
    const baseUrl = await startServer(protocol);

    const response = await fetch(
      `${baseUrl}/auth/sign-in?returnUrl=${encodeURIComponent('//attacker.example')}`,
      { redirect: 'manual' },
    );

    expect(response.status).toBe(400);
    expect(protocol.start).not.toHaveBeenCalled();
  });

  it('exchanges a valid callback, sets the session and hint, and clears the flow', async () => {
    const protocol = createProtocol();
    const baseUrl = await startServer(protocol);
    const flowCookie = await beginFlow(baseUrl, '/en/account');

    const response = await fetch(`${baseUrl}/auth/callback?code=code&state=state`, {
      headers: { Cookie: flowCookie },
      redirect: 'manual',
    });
    const setCookies = getSetCookies(response);

    expect(response.status).toBe(302);
    expect(response.headers.get('location')).toBe('/en/account');
    expect(protocol.exchange).toHaveBeenCalledOnce();
    expect(setCookies).toContainEqual(expect.stringMatching(/^ks=/));
    expect(setCookies).toContainEqual(expect.stringMatching(/^ks-hint=1/));
    expect(setCookies).toContainEqual(expect.stringMatching(/^ksf=; Max-Age=0/));
  });

  it('rejects a changed callback state before the token exchange', async () => {
    const protocol = createProtocol();
    const baseUrl = await startServer(protocol);
    const flowCookie = await beginFlow(baseUrl, '/');

    const response = await fetch(`${baseUrl}/auth/callback?code=code&state=changed`, {
      headers: { Cookie: flowCookie },
      redirect: 'manual',
    });

    expect(response.status).toBe(400);
    expect(protocol.exchange).not.toHaveBeenCalled();
    expect(getSetCookies(response)).toContainEqual(expect.stringMatching(/^ksf=; Max-Age=0/));
  });

  it('sends an unverified session to verification and keeps the destination', async () => {
    const protocol = createProtocol();
    protocol.exchange.mockResolvedValueOnce({ ...session, ev: false });
    const baseUrl = await startServer(protocol);
    const flowCookie = await beginFlow(baseUrl, '/en/barbershops?near=me');

    const response = await fetch(`${baseUrl}/auth/callback?code=code&state=state`, {
      headers: { Cookie: flowCookie },
      redirect: 'manual',
    });

    expect(response.status).toBe(302);
    expect(response.headers.get('location')).toBe(
      `/en/verify-email?returnUrl=${encodeURIComponent('/en/barbershops?near=me')}`,
    );
    expect(getSetCookies(response)).toContainEqual(expect.stringMatching(/^ks=/));
  });

  it('takes the verification language from the account when the destination has none', async () => {
    const protocol = createProtocol();
    protocol.exchange.mockResolvedValueOnce({ ...session, ev: false, loc: 'en' });
    const baseUrl = await startServer(protocol);
    const flowCookie = await beginFlow(baseUrl, '/');

    const response = await fetch(`${baseUrl}/auth/callback?code=code&state=state`, {
      headers: { Cookie: flowCookie },
      redirect: 'manual',
    });

    expect(response.headers.get('location')).toBe(
      `/en/verify-email?returnUrl=${encodeURIComponent('/')}`,
    );
  });

  it('does not nest verification inside itself when the account is still unverified', async () => {
    const protocol = createProtocol();
    protocol.exchange.mockResolvedValueOnce({ ...session, ev: false });
    const baseUrl = await startServer(protocol);
    const flowCookie = await beginFlow(baseUrl, '/el/verify-email?returnUrl=%2Fel%2Fbarbershops');

    const response = await fetch(`${baseUrl}/auth/callback?code=code&state=state`, {
      headers: { Cookie: flowCookie },
      redirect: 'manual',
    });

    expect(response.headers.get('location')).toBe(
      `/el/verify-email?returnUrl=${encodeURIComponent('/el')}`,
    );
  });

  it.each([
    ['login_required', '/en/barbershops'],
    ['access_denied', '/'],
  ])('maps %s to a designed redirect', async (error, target) => {
    const protocol = createProtocol();
    const baseUrl = await startServer(protocol);
    const flowCookie = await beginFlow(baseUrl, '/en/barbershops');

    const response = await fetch(`${baseUrl}/auth/callback?error=${error}&state=state`, {
      headers: { Cookie: flowCookie },
      redirect: 'manual',
    });

    expect(response.status).toBe(302);
    expect(response.headers.get('location')).toBe(target);
    expect(protocol.exchange).not.toHaveBeenCalled();
  });
});

describe('BFF password change route', () => {
  it('starts the password action with the same flow cookie as sign-in', async () => {
    const protocol = createProtocol();
    const baseUrl = await startServer(protocol);

    const response = await fetch(
      `${baseUrl}/auth/account/password?returnUrl=${encodeURIComponent('/el/account?tab=security')}`,
      { redirect: 'manual' },
    );

    expect(response.status).toBe(302);
    expect(response.headers.get('location')).toBe('https://identity.example/authorize');
    expect(protocol.start).toHaveBeenCalledWith(
      'update-password',
      '/el/account?tab=security',
      'el',
    );
    expect(getSetCookies(response)).toContainEqual(
      expect.stringMatching(/^ksf=.*; Max-Age=600; Path=\/; HttpOnly; SameSite=Lax$/),
    );
  });

  it.each(['//attacker.example', 'https://attacker.example/account', '/\\attacker.example'])(
    'refuses the unsafe return URL %s and falls back to the landing page',
    async (returnUrl) => {
      const protocol = createProtocol();
      const baseUrl = await startServer(protocol);

      const response = await fetch(
        `${baseUrl}/auth/account/password?returnUrl=${encodeURIComponent(returnUrl)}`,
        { redirect: 'manual' },
      );

      expect(response.status).toBe(302);
      expect(protocol.start).toHaveBeenCalledWith('update-password', '/', undefined);
    },
  );

  it('forwards a successful action and refreshes the session with the new tokens', async () => {
    const protocol = createProtocol();
    const baseUrl = await startServer(protocol);
    const flowCookie = await beginFlow(baseUrl, '/el/account?tab=security', 'account/password');

    const response = await fetch(
      `${baseUrl}/auth/callback?code=code&state=state&kc_action_status=success`,
      { headers: { Cookie: flowCookie }, redirect: 'manual' },
    );
    const setCookies = getSetCookies(response);

    expect(response.status).toBe(302);
    expect(response.headers.get('location')).toBe(
      '/el/account?tab=security&kc_action_status=success',
    );
    expect(protocol.exchange).toHaveBeenCalledOnce();
    expect(setCookies).toContainEqual(expect.stringMatching(/^ks=v/));
    expect(setCookies).toContainEqual(expect.stringMatching(/^ksf=; Max-Age=0/));
  });

  it('forwards a cancelled action that carries a code', async () => {
    const protocol = createProtocol();
    const baseUrl = await startServer(protocol);
    const flowCookie = await beginFlow(baseUrl, '/en/account', 'account/password');

    const response = await fetch(
      `${baseUrl}/auth/callback?code=code&state=state&kc_action_status=cancelled`,
      { headers: { Cookie: flowCookie }, redirect: 'manual' },
    );

    expect(response.status).toBe(302);
    expect(response.headers.get('location')).toBe('/en/account?kc_action_status=cancelled');
    expect(protocol.exchange).toHaveBeenCalledOnce();
  });

  it('forwards a cancelled action without a code and keeps the session', async () => {
    const protocol = createProtocol();
    const baseUrl = await startServer(protocol);
    const flowCookie = await beginFlow(baseUrl, '/en/account', 'account/password');

    const response = await fetch(
      `${baseUrl}/auth/callback?state=state&kc_action_status=cancelled`,
      {
        headers: { Cookie: `${flowCookie}; ${sessionCookie(session)}` },
        redirect: 'manual',
      },
    );

    expect(response.status).toBe(302);
    expect(response.headers.get('location')).toBe('/en/account?kc_action_status=cancelled');
    expect(protocol.exchange).not.toHaveBeenCalled();
    expect(getSetCookies(response)).toEqual([expect.stringMatching(/^ksf=; Max-Age=0/)]);
  });

  it('forwards a failed action that the provider reports as an error', async () => {
    const protocol = createProtocol();
    const baseUrl = await startServer(protocol);
    const flowCookie = await beginFlow(baseUrl, '/en/account', 'account/password');

    const response = await fetch(
      `${baseUrl}/auth/callback?error=server_error&state=state&kc_action_status=error`,
      { headers: { Cookie: `${flowCookie}; ${sessionCookie(session)}` }, redirect: 'manual' },
    );

    expect(response.status).toBe(302);
    expect(response.headers.get('location')).toBe('/en/account?kc_action_status=error');
    expect(getSetCookies(response)).toEqual([expect.stringMatching(/^ksf=; Max-Age=0/)]);
  });

  it('ignores an unknown action status', async () => {
    const protocol = createProtocol();
    const baseUrl = await startServer(protocol);
    const flowCookie = await beginFlow(baseUrl, '/en/account', 'account/password');

    const response = await fetch(
      `${baseUrl}/auth/callback?code=code&state=state&kc_action_status=%2F%2Fattacker.example`,
      { headers: { Cookie: flowCookie }, redirect: 'manual' },
    );

    expect(response.headers.get('location')).toBe('/en/account');
  });
});

describe('BFF session routes', () => {
  it('returns public claims and never returns a token from the session endpoint', async () => {
    const protocol = createProtocol();
    const baseUrl = await startServer(protocol);
    const cookie = sessionCookie(session);

    const response = await fetch(`${baseUrl}/auth/session`, { headers: { Cookie: cookie } });
    const body: unknown = await response.json();

    expect(body).toEqual({
      signedIn: true,
      claims: {
        sub: 'person-1',
        email: 'person@example.com',
        emailVerified: true,
        givenName: 'Given',
        familyName: 'Family',
        locale: 'el',
      },
    });
    expect(JSON.stringify(body)).not.toContain('access-token');
    expect(JSON.stringify(body)).not.toContain('refresh-token');
    expect(response.headers.get('cache-control')).toBe('no-store');
  });

  it('returns the current access token without refreshing it early', async () => {
    const protocol = createProtocol();
    const baseUrl = await startServer(protocol);

    const response = await fetch(`${baseUrl}/auth/token`, {
      headers: { Cookie: sessionCookie(session) },
    });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ accessToken: 'access-token', expiresAt: NOW + 300 });
    expect(protocol.refresh).not.toHaveBeenCalled();
  });

  it('refreshes within 30 seconds and rewrites the complete session', async () => {
    const expiring = { ...session, exp: NOW + 30 };
    const refreshed = { ...session, at: 'new-access-token', exp: NOW + 300 };
    const protocol = createProtocol({ refreshed });
    const baseUrl = await startServer(protocol);

    const response = await fetch(`${baseUrl}/auth/token`, {
      headers: { Cookie: sessionCookie(expiring) },
    });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      accessToken: 'new-access-token',
      expiresAt: NOW + 300,
    });
    expect(protocol.refresh).toHaveBeenCalledWith(expiring);
    expect(getSetCookies(response)).toContainEqual(expect.stringMatching(/^ks=/));
    expect(getSetCookies(response)).toContainEqual(expect.stringMatching(/^ks-hint=1/));
  });

  it('clears the session and hint when refresh fails', async () => {
    const protocol = createProtocol();
    protocol.refresh.mockRejectedValueOnce(new Error('refresh rejected'));
    const baseUrl = await startServer(protocol);

    const response = await fetch(`${baseUrl}/auth/token`, {
      headers: { Cookie: sessionCookie({ ...session, exp: NOW }) },
    });

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ reason: 'session-expired' });
    expect(getSetCookies(response)).toContainEqual(expect.stringMatching(/^ks=; Max-Age=0/));
    expect(getSetCookies(response)).toContainEqual(expect.stringMatching(/^ks-hint=; Max-Age=0/));
  });

  it('allows parallel refreshes from the same cookie', async () => {
    let refreshNumber = 0;
    const protocol = createProtocol();
    protocol.refresh.mockImplementation((current) =>
      Promise.resolve({
        ...current,
        at: `access-${++refreshNumber}`,
        exp: NOW + 300,
      }),
    );
    const baseUrl = await startServer(protocol);
    const cookie = sessionCookie({ ...session, exp: NOW });

    const responses = await Promise.all(
      [1, 2].map(() => fetch(`${baseUrl}/auth/token`, { headers: { Cookie: cookie } })),
    );

    expect(responses.map((response) => response.status)).toEqual([200, 200]);
    expect(protocol.refresh).toHaveBeenCalledTimes(2);
  });

  it('checks the sign-out origin, logs out at the provider, and clears all cookies', async () => {
    const protocol = createProtocol();
    const baseUrl = await startServer(protocol);
    const cookie = `${sessionCookie(session)}; ksf=stale-flow`;

    const refused = await fetch(`${baseUrl}/auth/sign-out`, {
      method: 'POST',
      headers: { Cookie: cookie, Origin: 'https://attacker.example' },
    });
    expect(refused.status).toBe(403);
    expect(protocol.logout).not.toHaveBeenCalled();

    const response = await fetch(`${baseUrl}/auth/sign-out`, {
      method: 'POST',
      headers: { Cookie: cookie, Origin: ORIGIN },
    });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ redirectTo: '/' });
    expect(protocol.logout).toHaveBeenCalledWith('refresh-token');
    expect(getSetCookies(response)).toContainEqual(expect.stringMatching(/^ks=; Max-Age=0/));
    expect(getSetCookies(response)).toContainEqual(expect.stringMatching(/^ksf=; Max-Age=0/));
    expect(getSetCookies(response)).toContainEqual(expect.stringMatching(/^ks-hint=; Max-Age=0/));
  });

  it('refreshes on demand, rewrites the session, and returns the new claims only', async () => {
    const verified = { ...session, ev: true, at: 'new-access-token', exp: NOW + 300 };
    const protocol = createProtocol({ refreshed: verified });
    const baseUrl = await startServer(protocol);
    const unverified = { ...session, ev: false };

    const response = await fetch(`${baseUrl}/auth/refresh`, {
      method: 'POST',
      headers: { Cookie: sessionCookie(unverified), Origin: ORIGIN },
    });
    const body: unknown = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({
      signedIn: true,
      claims: {
        sub: 'person-1',
        email: 'person@example.com',
        emailVerified: true,
        givenName: 'Given',
        familyName: 'Family',
        locale: 'el',
      },
      expiresAt: NOW + 300,
    });
    expect(JSON.stringify(body)).not.toContain('new-access-token');
    expect(JSON.stringify(body)).not.toContain('refresh-token');
    expect(protocol.refresh).toHaveBeenCalledWith(unverified);
    expect(getSetCookies(response)).toContainEqual(expect.stringMatching(/^ks=/));
    expect(response.headers.get('cache-control')).toBe('no-store');
  });

  // The provider may answer a refresh without an ID token, in which case the claims carry over
  // from the previous session. The endpoint must still answer with what the session now holds.
  it('answers with the carried-over claims when the refresh returns no ID token', async () => {
    const protocol = createProtocol();
    protocol.refresh.mockImplementationOnce((current) =>
      Promise.resolve({ ...current, at: 'new-access-token', exp: NOW + 300 }),
    );
    const baseUrl = await startServer(protocol);

    const response = await fetch(`${baseUrl}/auth/refresh`, {
      method: 'POST',
      headers: { Cookie: sessionCookie({ ...session, ev: false }), Origin: ORIGIN },
    });

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ claims: { emailVerified: false } });
  });

  it('re-seals the session with a new language and leaves the rest of it alone', async () => {
    const protocol = createProtocol();
    const baseUrl = await startServer(protocol);

    const response = await fetch(`${baseUrl}/auth/language`, {
      method: 'POST',
      headers: {
        Cookie: sessionCookie(session),
        Origin: ORIGIN,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ language: 'en' }),
    });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ locale: 'en' });
    expect(getSetCookies(response)).toContainEqual(expect.stringMatching(/^ks=/));
    // No provider call: this rewrites a claim in a payload this server sealed itself.
    expect(protocol.refresh).not.toHaveBeenCalled();

    const resealed = getSetCookies(response)
      .map((cookie) => cookie.split(';')[0])
      .join('; ');
    const session2 = await fetch(`${baseUrl}/auth/session`, { headers: { Cookie: resealed } });

    expect(await session2.json()).toEqual({
      signedIn: true,
      claims: {
        sub: 'person-1',
        email: 'person@example.com',
        emailVerified: true,
        givenName: 'Given',
        familyName: 'Family',
        locale: 'en',
      },
    });
  });

  it('writes no cookie when the session already says that language', async () => {
    const protocol = createProtocol();
    const baseUrl = await startServer(protocol);

    const response = await fetch(`${baseUrl}/auth/language`, {
      method: 'POST',
      headers: {
        Cookie: sessionCookie(session),
        Origin: ORIGIN,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ language: 'el' }),
    });

    expect(response.status).toBe(200);
    expect(getSetCookies(response)).toEqual([]);
  });

  it.each([
    ['a language the site does not publish', { language: 'de' }],
    ['a language that is not a string', { language: 1 }],
    ['a body with no language at all', {}],
  ])('refuses %s', async (_name, body) => {
    const protocol = createProtocol();
    const baseUrl = await startServer(protocol);

    const response = await fetch(`${baseUrl}/auth/language`, {
      method: 'POST',
      headers: {
        Cookie: sessionCookie(session),
        Origin: ORIGIN,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    expect(response.status).toBe(400);
    expect(getSetCookies(response)).toEqual([]);
  });

  it('refuses a cross-origin language change', async () => {
    const protocol = createProtocol();
    const baseUrl = await startServer(protocol);

    const response = await fetch(`${baseUrl}/auth/language`, {
      method: 'POST',
      headers: {
        Cookie: sessionCookie(session),
        Origin: 'https://attacker.example',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ language: 'en' }),
    });

    expect(response.status).toBe(403);
    expect(getSetCookies(response)).toEqual([]);
  });

  it('expires a language change that carries no session', async () => {
    const protocol = createProtocol();
    const baseUrl = await startServer(protocol);

    const response = await fetch(`${baseUrl}/auth/language`, {
      method: 'POST',
      headers: { Origin: ORIGIN, 'Content-Type': 'application/json' },
      body: JSON.stringify({ language: 'en' }),
    });

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ reason: 'session-expired' });
  });

  it('refuses a cross-origin refresh', async () => {
    const protocol = createProtocol();
    const baseUrl = await startServer(protocol);

    const response = await fetch(`${baseUrl}/auth/refresh`, {
      method: 'POST',
      headers: { Cookie: sessionCookie(session), Origin: 'https://attacker.example' },
    });

    expect(response.status).toBe(403);
    expect(protocol.refresh).not.toHaveBeenCalled();
  });

  it.each([
    ['without a session', undefined],
    ['when the provider refuses', sessionCookie],
  ])('expires the session on a refresh that cannot complete %s', async (_name, cookie) => {
    const protocol = createProtocol();
    protocol.refresh.mockRejectedValueOnce(new Error('refresh rejected'));
    const baseUrl = await startServer(protocol);

    const response = await fetch(`${baseUrl}/auth/refresh`, {
      method: 'POST',
      headers: { Origin: ORIGIN, ...(cookie ? { Cookie: cookie(session) } : {}) },
    });

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ reason: 'session-expired' });
    expect(getSetCookies(response)).toContainEqual(expect.stringMatching(/^ks=; Max-Age=0/));
    expect(getSetCookies(response)).toContainEqual(expect.stringMatching(/^ks-hint=; Max-Age=0/));
  });

  it('redirects the legacy signed-out URL to the landing page', async () => {
    const baseUrl = await startServer(createProtocol());

    const response = await fetch(`${baseUrl}/auth/signed-out`, { redirect: 'manual' });

    expect(response.status).toBe(302);
    expect(response.headers.get('location')).toBe('/');
    expect(response.headers.get('cache-control')).toBe('no-store');
  });
});

function createProtocol(options?: { refreshed?: SessionPayload }): ProtocolMock {
  return {
    start: vi.fn((_kind: AuthorizationKind, returnUrl: string) =>
      Promise.resolve({
        flow: createFlow(returnUrl),
        redirectUrl: new URL('https://identity.example/authorize'),
      }),
    ),
    exchange: vi.fn(() => Promise.resolve(session)),
    refresh: vi.fn(() => Promise.resolve(options?.refreshed ?? session)),
    logout: vi.fn(() => Promise.resolve()),
  };
}

function createFlow(returnUrl: string): AuthorizationFlow {
  return {
    v: 1,
    cv: 'code-verifier',
    state: 'state',
    nonce: 'nonce',
    returnUrl,
  };
}

async function startServer(protocol: AuthProtocolClient): Promise<string> {
  const app = express();
  app.use(
    '/auth',
    createAuthRouter({
      protocol,
      keyring,
      sessionCookie: { name: 'ks', secure: false },
      origin: ORIGIN,
      now: () => NOW,
      logger: { error: vi.fn() },
    }),
  );

  const server = await new Promise<Server>((resolve) => {
    const listening = app.listen(0, '127.0.0.1', () => {
      resolve(listening);
    });
  });
  servers.push(server);
  const address = server.address() as AddressInfo;
  return `http://127.0.0.1:${address.port}`;
}

async function beginFlow(baseUrl: string, returnUrl: string, route = 'sign-in'): Promise<string> {
  const response = await fetch(
    `${baseUrl}/auth/${route}?returnUrl=${encodeURIComponent(returnUrl)}`,
    { redirect: 'manual' },
  );
  const flow = getSetCookies(response).find((cookie) => cookie.startsWith('ksf='));
  if (flow === undefined) throw new Error('The flow cookie was not set.');
  return flow.split(';', 1)[0];
}

function sessionCookie(payload: SessionPayload): string {
  const headers = createSessionCookieHeaders(sealSession(payload, keyring), {
    name: 'ks',
    secure: false,
  });
  return headers
    .filter((header) => header.startsWith('ks=') || header.startsWith('ks.'))
    .map((header) => header.split(';', 1)[0])
    .join('; ');
}

function getSetCookies(response: Response): string[] {
  return (response.headers as Headers & { getSetCookie: () => string[] }).getSetCookie();
}

function closeServer(server: Server): Promise<void> {
  return new Promise((resolve, reject) => {
    server.close((error) => {
      if (error === undefined) resolve();
      else reject(error);
    });
  });
}
