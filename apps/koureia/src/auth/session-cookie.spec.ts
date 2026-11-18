import { randomBytes } from 'node:crypto';

import {
  InvalidSessionCookieError,
  SessionCookieConfig,
  SessionCookieKeyring,
  SessionPayload,
  clearSessionCookieHeaders,
  createSessionCookieHeaders,
  loadSessionCookieKeyring,
  readSessionCookie,
  sealSession,
  unsealSession,
} from './session-cookie';

const DEVELOPMENT: SessionCookieConfig = { name: 'ks', secure: false };
const PRODUCTION: SessionCookieConfig = { name: '__Host-ks', secure: true };

const payload: SessionPayload = {
  v: 1,
  rt: 'refresh-token',
  at: 'access-token',
  exp: 1_754_745_600,
  sub: 'user-1',
  email: 'person@example.com',
  ev: false,
  gn: 'Given',
  fn: 'Family',
  loc: 'el',
};

describe('session cookie crypto', () => {
  it('returns the complete payload after a seal and unseal round trip', () => {
    const keyring = createKeyring();

    const actual = unsealSession(sealSession(payload, keyring), keyring);

    expect(JSON.stringify(actual)).toBe(JSON.stringify(payload));
  });

  it.each([1, 2])('rejects a change in sealed segment %s', (segmentIndex) => {
    const keyring = createKeyring();
    const parts = sealSession(payload, keyring).split('.');
    parts[segmentIndex] = changeFirstCharacter(parts[segmentIndex]);

    expect(() => unsealSession(parts.join('.'), keyring)).toThrow(InvalidSessionCookieError);
  });

  it('rejects an authentication-tag change', () => {
    const keyring = createKeyring();
    const parts = sealSession(payload, keyring).split('.');
    parts[2] = changeLastCharacter(parts[2]);

    expect(() => unsealSession(parts.join('.'), keyring)).toThrow(InvalidSessionCookieError);
  });

  it('rejects a non-canonical base64url representation', () => {
    const keyring = createKeyring();
    const nonCanonicalPayload = { ...payload, fn: `${payload.fn}x` };
    const parts = sealSession(nonCanonicalPayload, keyring).split('.');
    parts[2] = makeNonCanonical(parts[2]);

    expect(() => unsealSession(parts.join('.'), keyring)).toThrow(InvalidSessionCookieError);
  });

  it('rejects a different format version', () => {
    const keyring = createKeyring();
    const sealed = sealSession(payload, keyring).replace(/^v1\./, 'v0.');

    expect(() => unsealSession(sealed, keyring)).toThrow(InvalidSessionCookieError);
  });

  it('decrypts with the previous key and encrypts with the current key', () => {
    const oldKeyring = createKeyring();
    const newKeyring: SessionCookieKeyring = {
      current: randomBytes(32),
      previous: oldKeyring.current,
    };

    expect(unsealSession(sealSession(payload, oldKeyring), newKeyring)).toEqual(payload);

    const rotated = sealSession(payload, newKeyring);
    expect(unsealSession(rotated, { current: newKeyring.current })).toEqual(payload);
    expect(() => unsealSession(rotated, oldKeyring)).toThrow(InvalidSessionCookieError);
  });

  it('loads one current key and an optional previous key from base64', () => {
    const current = randomBytes(32);
    const previous = randomBytes(32);

    const keyring = loadSessionCookieKeyring({
      AUTH_COOKIE_KEY: current.toString('base64'),
      AUTH_COOKIE_KEY_PREVIOUS: previous.toString('base64'),
    });

    expect(keyring.current).toEqual(current);
    expect(keyring.previous).toEqual(previous);
  });

  it.each([
    [{}, 'AUTH_COOKIE_KEY must be set.'],
    [{ AUTH_COOKIE_KEY: 'not base64' }, 'AUTH_COOKIE_KEY must be base64.'],
    [
      { AUTH_COOKIE_KEY: randomBytes(31).toString('base64') },
      'AUTH_COOKIE_KEY must contain exactly 32 bytes.',
    ],
  ])('rejects an unusable environment key', (environment, message) => {
    expect(() => loadSessionCookieKeyring(environment)).toThrow(message);
  });
});

describe('session cookie headers', () => {
  it('sets the development session and hint cookies', () => {
    const sealed = sealSession(payload, createKeyring());

    const headers = createSessionCookieHeaders(sealed, DEVELOPMENT);

    expect(headers).toHaveLength(2);
    expect(headers[0]).toContain(`ks=${sealed}`);
    expect(headers[0]).toContain('Max-Age=5184000');
    expect(headers[0]).toContain('Path=/');
    expect(headers[0]).toContain('HttpOnly');
    expect(headers[0]).toContain('SameSite=Lax');
    expect(headers[0]).not.toContain('Secure');
    expect(headers[1]).toContain('ks-hint=1');
    expect(headers[1]).not.toContain('HttpOnly');
  });

  it('sets Secure on both production cookies', () => {
    const sealed = sealSession(payload, createKeyring());

    const headers = createSessionCookieHeaders(sealed, PRODUCTION);

    expect(headers[0]).toContain('__Host-ks=');
    expect(headers[0]).toContain('Secure');
    expect(headers[1]).toContain('ks-hint=1');
    expect(headers[1]).toContain('Secure');
  });

  it('chunks and reassembles a payload larger than one cookie', () => {
    const largePayload: SessionPayload = {
      ...payload,
      rt: 'r'.repeat(1_500),
      at: 'a'.repeat(3_500),
    };
    const sealed = sealSession(largePayload, createKeyring());

    const headers = createSessionCookieHeaders(sealed, PRODUCTION);
    const sessionHeaders = headers.filter((header) => header.startsWith('__Host-ks.'));
    const requestHeader = toRequestCookieHeader(sessionHeaders);

    expect(sessionHeaders.length).toBeGreaterThan(1);
    expect(sessionHeaders.every((header) => Buffer.byteLength(header) <= 4096)).toBe(true);
    expect(readSessionCookie(requestHeader, PRODUCTION)).toBe(sealed);
  });

  it('rejects incomplete, duplicate, and mixed chunk sets', () => {
    expect(readSessionCookie('ks.0=first; ks.2=third', DEVELOPMENT)).toBeNull();
    expect(readSessionCookie('ks.0=first; ks.0=other', DEVELOPMENT)).toBeNull();
    expect(readSessionCookie('ks=bare; ks.0=chunk', DEVELOPMENT)).toBeNull();
  });

  it('clears stale chunks when a rewritten session fits one cookie', () => {
    const sealed = sealSession(payload, createKeyring());
    const headers = createSessionCookieHeaders(
      sealed,
      DEVELOPMENT,
      'ks.0=old-first; ks.1=old-second; unrelated=value',
    );

    expect(
      headers.some((header) => header.startsWith('ks=') && !header.includes('Max-Age=0')),
    ).toBe(true);
    expect(headers).toContainEqual(expect.stringMatching(/^ks\.0=; Max-Age=0/));
    expect(headers).toContainEqual(expect.stringMatching(/^ks\.1=; Max-Age=0/));
  });

  it('clears the session chunks and hint cookie in lockstep', () => {
    const headers = clearSessionCookieHeaders(
      PRODUCTION,
      '__Host-ks.0=first; __Host-ks.1=second; ks-hint=1',
    );

    expect(headers).toContainEqual(expect.stringMatching(/^__Host-ks\.0=; Max-Age=0/));
    expect(headers).toContainEqual(expect.stringMatching(/^__Host-ks\.1=; Max-Age=0/));
    expect(headers).toContainEqual(expect.stringMatching(/^ks-hint=; Max-Age=0/));
    expect(headers.every((header) => header.includes('SameSite=Lax'))).toBe(true);
  });
});

function createKeyring(): SessionCookieKeyring {
  return { current: randomBytes(32) };
}

function changeFirstCharacter(value: string | undefined): string {
  if (value === undefined || value === '') throw new Error('Missing sealed segment.');
  return `${value.startsWith('A') ? 'B' : 'A'}${value.slice(1)}`;
}

function changeLastCharacter(value: string | undefined): string {
  if (value === undefined || value === '') throw new Error('Missing sealed segment.');
  return `${value.slice(0, -1)}${value.endsWith('A') ? 'B' : 'A'}`;
}

function makeNonCanonical(value: string | undefined): string {
  if (value === undefined || value === '') throw new Error('Missing sealed segment.');
  const decoded = Buffer.from(value, 'base64url');
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';

  for (const character of alphabet) {
    const candidate = replaceLastCharacter(value, character);
    if (candidate !== value && Buffer.from(candidate, 'base64url').equals(decoded)) {
      return candidate;
    }
  }
  throw new Error('The sealed segment has no alternate base64url representation.');
}

function replaceLastCharacter(value: string, character: string): string {
  return `${value.slice(0, -1)}${character}`;
}

function toRequestCookieHeader(setCookieHeaders: readonly string[]): string {
  return setCookieHeaders.map((header) => header.split(';', 1)[0]).join('; ');
}
