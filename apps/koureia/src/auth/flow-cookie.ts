import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

import { SessionCookieKeyring } from './session-cookie';

const FLOW_VERSION = 1;
const SEALED_PREFIX = `v${FLOW_VERSION}`;
const IV_BYTES = 12;
const AUTH_TAG_BYTES = 16;
const FLOW_MAX_AGE_SECONDS = 600;
const SEALED_VALUE_PATTERN = /^v1\.[A-Za-z\d_-]+\.[A-Za-z\d_-]+$/;

export interface AuthorizationFlow {
  readonly v: 1;
  readonly cv: string;
  readonly state: string;
  readonly nonce: string;
  readonly returnUrl: string;
}

export type FlowCookieConfig =
  | Readonly<{ name: '__Host-ksf'; secure: true }>
  | Readonly<{ name: 'ksf'; secure: false }>;

export function sealAuthorizationFlow(
  flow: AuthorizationFlow,
  keyring: SessionCookieKeyring,
): string {
  assertAuthorizationFlow(flow);
  assertKey(keyring.current);

  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv('aes-256-gcm', keyring.current, iv, {
    authTagLength: AUTH_TAG_BYTES,
  });
  cipher.setAAD(Buffer.from(SEALED_PREFIX));
  const ciphertext = Buffer.concat([cipher.update(JSON.stringify(flow), 'utf8'), cipher.final()]);
  const protectedPayload = Buffer.concat([ciphertext, cipher.getAuthTag()]);

  return `${SEALED_PREFIX}.${iv.toString('base64url')}.${protectedPayload.toString('base64url')}`;
}

export function unsealAuthorizationFlow(
  sealed: string,
  keyring: SessionCookieKeyring,
): AuthorizationFlow | null {
  if (!SEALED_VALUE_PATTERN.test(sealed)) return null;
  assertKey(keyring.current);
  if (keyring.previous !== undefined) assertKey(keyring.previous);

  const [, encodedIv, encodedPayload] = sealed.split('.');
  const iv = Buffer.from(encodedIv, 'base64url');
  const protectedPayload = Buffer.from(encodedPayload, 'base64url');
  if (
    iv.length !== IV_BYTES ||
    protectedPayload.length <= AUTH_TAG_BYTES ||
    iv.toString('base64url') !== encodedIv ||
    protectedPayload.toString('base64url') !== encodedPayload
  ) {
    return null;
  }

  const keys =
    keyring.previous === undefined ? [keyring.current] : [keyring.current, keyring.previous];

  for (const key of keys) {
    const plaintext = decrypt(protectedPayload, iv, key);
    if (plaintext === null) continue;

    try {
      const flow: unknown = JSON.parse(plaintext);
      return isAuthorizationFlow(flow) ? flow : null;
    } catch {
      return null;
    }
  }

  return null;
}

export function createFlowCookieHeader(sealed: string, config: FlowCookieConfig): string {
  assertConfig(config);
  if (!SEALED_VALUE_PATTERN.test(sealed)) throw new Error('The authorization flow is invalid.');

  return serializeCookie(config.name, sealed, FLOW_MAX_AGE_SECONDS, config.secure);
}

export function clearFlowCookieHeader(config: FlowCookieConfig): string {
  assertConfig(config);
  const secure = config.secure ? '; Secure' : '';
  return `${config.name}=; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT; Path=/; HttpOnly${secure}; SameSite=Lax`;
}

export function readFlowCookie(
  cookieHeader: string | undefined,
  config: FlowCookieConfig,
): string | null {
  assertConfig(config);
  if (cookieHeader === undefined) return null;

  const values = cookieHeader.split(';').flatMap((part) => {
    const separator = part.indexOf('=');
    if (separator < 1 || part.slice(0, separator).trim() !== config.name) return [];
    return [part.slice(separator + 1).trim()];
  });

  return values.length === 1 && values[0] !== '' ? values[0] : null;
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

function serializeCookie(name: string, value: string, maxAge: number, secure: boolean): string {
  const secureAttribute = secure ? '; Secure' : '';
  return `${name}=${value}; Max-Age=${maxAge}; Path=/; HttpOnly${secureAttribute}; SameSite=Lax`;
}

function assertAuthorizationFlow(flow: AuthorizationFlow): void {
  if (!isAuthorizationFlow(flow)) throw new TypeError('The authorization flow is invalid.');
}

function isAuthorizationFlow(flow: unknown): flow is AuthorizationFlow {
  if (typeof flow !== 'object' || flow === null || Array.isArray(flow)) return false;

  const entry = flow as Record<string, unknown>;
  const keys = ['v', 'cv', 'state', 'nonce', 'returnUrl'];
  return (
    Object.keys(entry).length === keys.length &&
    keys.every((key) => key in entry) &&
    entry['v'] === FLOW_VERSION &&
    isNonEmptyString(entry['cv']) &&
    isNonEmptyString(entry['state']) &&
    isNonEmptyString(entry['nonce']) &&
    isSafeReturnUrl(entry['returnUrl'])
  );
}

function isSafeReturnUrl(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    value.startsWith('/') &&
    !value.startsWith('//') &&
    !value.includes('\\') &&
    !value.includes('\0')
  );
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value !== '';
}

function assertKey(key: Uint8Array): void {
  if (key.byteLength !== 32) throw new Error('The flow-cookie key must contain 32 bytes.');
}

function assertConfig(config: FlowCookieConfig): void {
  const validProduction = config.name === '__Host-ksf' && config.secure;
  const validDevelopment = config.name === 'ksf' && !config.secure;
  if (!validProduction && !validDevelopment) {
    throw new Error('The flow-cookie name and Secure attribute do not match.');
  }
}
