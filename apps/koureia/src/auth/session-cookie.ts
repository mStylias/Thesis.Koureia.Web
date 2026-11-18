import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

const SESSION_VERSION = 1;
const SEALED_PREFIX = `v${SESSION_VERSION}`;
const IV_BYTES = 12;
const AUTH_TAG_BYTES = 16;
const COOKIE_LIMIT_BYTES = 4096;
const SESSION_MAX_AGE_SECONDS = 5_184_000;
const HINT_COOKIE_NAME = 'ks-hint';
const BASE64_PATTERN = /^(?:[A-Za-z\d+/]{4})*(?:[A-Za-z\d+/]{2}==|[A-Za-z\d+/]{3}=)?$/;
const SEALED_VALUE_PATTERN = /^v1\.[A-Za-z\d_-]+\.[A-Za-z\d_-]+$/;

export interface SessionPayload {
  readonly v: 1;
  readonly rt: string;
  readonly at: string;
  readonly exp: number;
  readonly sub: string;
  readonly email: string;
  readonly ev: boolean;
  readonly gn: string;
  readonly fn: string;
  readonly loc: string;
}

export interface SessionCookieKeyring {
  readonly current: Uint8Array;
  readonly previous?: Uint8Array;
}

export type SessionCookieConfig =
  | Readonly<{ name: '__Host-ks'; secure: true }>
  | Readonly<{ name: 'ks'; secure: false }>;

type Environment = Readonly<Record<string, string | undefined>>;

interface CookiePart {
  readonly name: string;
  readonly value: string;
}

export class InvalidSessionCookieError extends Error {
  constructor() {
    super('The session cookie is invalid.');
    this.name = 'InvalidSessionCookieError';
  }
}

export function loadSessionCookieKeyring(environment: Environment): SessionCookieKeyring {
  const current = readKey(environment['AUTH_COOKIE_KEY'], 'AUTH_COOKIE_KEY');
  const previousValue = environment['AUTH_COOKIE_KEY_PREVIOUS'];

  return previousValue === undefined
    ? { current }
    : {
        current,
        previous: readKey(previousValue, 'AUTH_COOKIE_KEY_PREVIOUS'),
      };
}

export function sealSession(payload: SessionPayload, keyring: SessionCookieKeyring): string {
  assertPayload(payload);
  assertKey(keyring.current, 'current');

  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv('aes-256-gcm', keyring.current, iv, {
    authTagLength: AUTH_TAG_BYTES,
  });
  cipher.setAAD(Buffer.from(SEALED_PREFIX));

  const ciphertext = Buffer.concat([
    cipher.update(JSON.stringify(payload), 'utf8'),
    cipher.final(),
  ]);
  const protectedPayload = Buffer.concat([ciphertext, cipher.getAuthTag()]);

  return `${SEALED_PREFIX}.${iv.toString('base64url')}.${protectedPayload.toString('base64url')}`;
}

export function unsealSession(sealed: string, keyring: SessionCookieKeyring): SessionPayload {
  assertKey(keyring.current, 'current');
  if (keyring.previous !== undefined) assertKey(keyring.previous, 'previous');

  const parts = sealed.split('.');
  if (parts.length !== 3 || parts[0] !== SEALED_PREFIX || !SEALED_VALUE_PATTERN.test(sealed)) {
    throw new InvalidSessionCookieError();
  }

  const iv = Buffer.from(parts[1], 'base64url');
  const protectedPayload = Buffer.from(parts[2], 'base64url');
  if (
    iv.length !== IV_BYTES ||
    protectedPayload.length <= AUTH_TAG_BYTES ||
    iv.toString('base64url') !== parts[1] ||
    protectedPayload.toString('base64url') !== parts[2]
  ) {
    throw new InvalidSessionCookieError();
  }

  const keys =
    keyring.previous === undefined ? [keyring.current] : [keyring.current, keyring.previous];

  for (const key of keys) {
    const plaintext = decrypt(protectedPayload, iv, key);
    if (plaintext === null) continue;

    const payload = parsePayload(plaintext);
    if (payload !== null) return payload;
    throw new InvalidSessionCookieError();
  }

  throw new InvalidSessionCookieError();
}

export function createSessionCookieHeaders(
  sealed: string,
  config: SessionCookieConfig,
  existingCookieHeader?: string,
): readonly string[] {
  assertConfig(config);
  if (!SEALED_VALUE_PATTERN.test(sealed)) {
    throw new InvalidSessionCookieError();
  }

  const parts = splitCookieValue(sealed, config);
  const nextNames = new Set(parts.map((part) => part.name));
  const staleNames = getSessionCookieNames(existingCookieHeader, config.name).filter(
    (name) => !nextNames.has(name),
  );

  return [
    ...parts.map((part) => serializeCookie(part, config.secure, true)),
    ...staleNames.map((name) => clearCookie(name, config.secure, true)),
    serializeCookie({ name: HINT_COOKIE_NAME, value: '1' }, config.secure, false),
  ];
}

export function clearSessionCookieHeaders(
  config: SessionCookieConfig,
  existingCookieHeader?: string,
): readonly string[] {
  assertConfig(config);
  const names = new Set([config.name, ...getSessionCookieNames(existingCookieHeader, config.name)]);

  return [
    ...[...names].map((name) => clearCookie(name, config.secure, true)),
    clearCookie(HINT_COOKIE_NAME, config.secure, false),
  ];
}

export function readSessionCookie(
  cookieHeader: string | undefined,
  config: SessionCookieConfig,
): string | null {
  assertConfig(config);
  if (cookieHeader === undefined) return null;

  const cookies = parseCookieHeader(cookieHeader);
  const bareValues = cookies.filter(([name]) => name === config.name).map(([, value]) => value);
  const chunkPattern = new RegExp(`^${escapeRegExp(config.name)}\\.(0|[1-9]\\d*)$`);
  const chunks = new Map<number, string>();

  for (const [name, value] of cookies) {
    const match = chunkPattern.exec(name);
    if (match === null) continue;

    const index = Number(match[1]);
    if (chunks.has(index) || value === '') return null;
    chunks.set(index, value);
  }

  if (bareValues.length > 1 || (bareValues.length === 1 && chunks.size > 0)) {
    return null;
  }
  if (bareValues.length === 1) return bareValues[0] || null;
  if (chunks.size === 0) return null;

  const values: string[] = [];
  for (let index = 0; index < chunks.size; index += 1) {
    const value = chunks.get(index);
    if (value === undefined) return null;
    values.push(value);
  }

  return values.join('');
}

function readKey(value: string | undefined, variableName: string): Uint8Array {
  if (value === undefined || value === '') {
    throw new Error(`${variableName} must be set.`);
  }
  if (!BASE64_PATTERN.test(value)) {
    throw new Error(`${variableName} must be base64.`);
  }

  const key = Buffer.from(value, 'base64');
  if (key.length !== 32 || key.toString('base64') !== value) {
    throw new Error(`${variableName} must contain exactly 32 bytes.`);
  }
  return key;
}

function assertKey(key: Uint8Array, keyName: string): void {
  if (key.byteLength !== 32) {
    throw new Error(`The ${keyName} session-cookie key must contain 32 bytes.`);
  }
}

function decrypt(protectedPayload: Buffer, iv: Buffer, key: Uint8Array): string | null {
  const ciphertext = protectedPayload.subarray(0, -AUTH_TAG_BYTES);
  const authTag = protectedPayload.subarray(-AUTH_TAG_BYTES);

  try {
    const decipher = createDecipheriv('aes-256-gcm', key, iv, {
      authTagLength: AUTH_TAG_BYTES,
    });
    decipher.setAAD(Buffer.from(SEALED_PREFIX));
    decipher.setAuthTag(authTag);
    return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8');
  } catch {
    return null;
  }
}

function parsePayload(plaintext: string): SessionPayload | null {
  let payload: unknown;
  try {
    payload = JSON.parse(plaintext);
  } catch {
    return null;
  }
  return isSessionPayload(payload) ? payload : null;
}

function assertPayload(payload: SessionPayload): void {
  if (!isSessionPayload(payload)) {
    throw new TypeError('The session payload is invalid.');
  }
}

function isSessionPayload(payload: unknown): payload is SessionPayload {
  if (typeof payload !== 'object' || payload === null || Array.isArray(payload)) {
    return false;
  }

  const entry = payload as Record<string, unknown>;
  const expectedKeys = ['v', 'rt', 'at', 'exp', 'sub', 'email', 'ev', 'gn', 'fn', 'loc'];
  if (
    Object.keys(entry).length !== expectedKeys.length ||
    expectedKeys.some((key) => !(key in entry))
  ) {
    return false;
  }

  return (
    entry['v'] === SESSION_VERSION &&
    typeof entry['rt'] === 'string' &&
    entry['rt'] !== '' &&
    typeof entry['at'] === 'string' &&
    entry['at'] !== '' &&
    typeof entry['exp'] === 'number' &&
    Number.isSafeInteger(entry['exp']) &&
    entry['exp'] > 0 &&
    typeof entry['sub'] === 'string' &&
    entry['sub'] !== '' &&
    typeof entry['email'] === 'string' &&
    typeof entry['ev'] === 'boolean' &&
    typeof entry['gn'] === 'string' &&
    typeof entry['fn'] === 'string' &&
    typeof entry['loc'] === 'string'
  );
}

function splitCookieValue(value: string, config: SessionCookieConfig): readonly CookiePart[] {
  const bareCapacity = cookieValueCapacity(config.name, config.secure, true);
  if (value.length <= bareCapacity) {
    return [{ name: config.name, value }];
  }

  const parts: CookiePart[] = [];
  let offset = 0;
  let index = 0;
  while (offset < value.length) {
    const name = `${config.name}.${index}`;
    const capacity = cookieValueCapacity(name, config.secure, true);
    parts.push({ name, value: value.slice(offset, offset + capacity) });
    offset += capacity;
    index += 1;
  }
  return parts;
}

function cookieValueCapacity(name: string, secure: boolean, httpOnly: boolean): number {
  return (
    COOKIE_LIMIT_BYTES - Buffer.byteLength(serializeCookie({ name, value: '' }, secure, httpOnly))
  );
}

function serializeCookie(cookie: CookiePart, secure: boolean, httpOnly: boolean): string {
  const attributes = [
    `Max-Age=${SESSION_MAX_AGE_SECONDS}`,
    'Path=/',
    httpOnly ? 'HttpOnly' : null,
    secure ? 'Secure' : null,
    'SameSite=Lax',
  ].filter((attribute): attribute is string => attribute !== null);

  return `${cookie.name}=${cookie.value}; ${attributes.join('; ')}`;
}

function clearCookie(name: string, secure: boolean, httpOnly: boolean): string {
  const attributes = [
    'Max-Age=0',
    'Expires=Thu, 01 Jan 1970 00:00:00 GMT',
    'Path=/',
    httpOnly ? 'HttpOnly' : null,
    secure ? 'Secure' : null,
    'SameSite=Lax',
  ].filter((attribute): attribute is string => attribute !== null);

  return `${name}=; ${attributes.join('; ')}`;
}

function getSessionCookieNames(cookieHeader: string | undefined, name: string): readonly string[] {
  if (cookieHeader === undefined) return [];
  const pattern = new RegExp(`^${escapeRegExp(name)}(?:\\.(?:0|[1-9]\\d*))?$`);
  return [
    ...new Set(
      parseCookieHeader(cookieHeader)
        .map(([cookieName]) => cookieName)
        .filter((cookieName) => pattern.test(cookieName)),
    ),
  ];
}

function parseCookieHeader(header: string): readonly (readonly [string, string])[] {
  return header.split(';').flatMap((part) => {
    const separator = part.indexOf('=');
    if (separator < 1) return [];
    return [[part.slice(0, separator).trim(), part.slice(separator + 1).trim()] as const];
  });
}

function assertConfig(config: SessionCookieConfig): void {
  const validProduction = config.name === '__Host-ks' && config.secure;
  const validDevelopment = config.name === 'ks' && !config.secure;
  if (!validProduction && !validDevelopment) {
    throw new Error('The session-cookie name and Secure attribute do not match.');
  }
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
