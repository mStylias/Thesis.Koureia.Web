#!/usr/bin/env node
/**
 * Writes the local BFF environment file that `nx serve koureia` loads.
 *
 * The BFF refuses to start without `KOUREIA_BFF_*` and `AUTH_COOKIE_KEY`, and the repository
 * holds no value for them. This script makes them on the developer machine instead.
 *
 * Keycloak shares the client secret: `keycloak-config-cli` copies it from `Aptison.Booking/.env`
 * into the `koureia-bff` client at each `docker compose up`. So this script reads that file, and
 * writes a new secret into it when it is empty.
 *
 * Runs before `pnpm start` and does nothing when the file is already correct.
 */
import { randomBytes } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const TARGET = `${ROOT}apps/koureia/.env.development.local`;
const API_ENV = `${ROOT}../Aptison.Booking/.env`;
const API_ENV_EXAMPLE = `${ROOT}../Aptison.Booking/.env.example`;

const ISSUER = 'http://localhost:7030/realms/koureia';
const REDIRECT_URI = 'http://localhost:6100/auth/callback';
const SECRET_KEY = 'KOUREIA_BFF_CLIENT_SECRET';

if (existsSync(TARGET)) {
  process.exit(0);
}

const values = {
  KOUREIA_BFF_ISSUER: ISSUER,
  KOUREIA_BFF_REDIRECT_URI: REDIRECT_URI,
  KOUREIA_BFF_CLIENT_SECRET: readOrCreateClientSecret(),
  AUTH_COOKIE_KEY: randomBytes(32).toString('base64'),
};

const lines = Object.entries(values).map(([key, value]) => `${key}=${value}`);
writeFileSync(
  TARGET,
  [
    '# Written by tools/dev-env/dev-env.mjs. Git ignores it. Delete it to get new values.',
    `# ${SECRET_KEY} must stay equal to the one in Aptison.Booking/.env.`,
    ...lines,
    '',
  ].join('\n'),
  'utf8',
);
console.log('Wrote apps/koureia/.env.development.local');

/**
 * A new secret reaches Keycloak at the next `docker compose up`. Until then login fails with
 * `invalid_client`, so tell the developer.
 */
function readOrCreateClientSecret() {
  if (!existsSync(API_ENV)) {
    if (!existsSync(API_ENV_EXAMPLE)) {
      fail(
        `The sibling repository is not at ${API_ENV}.\n` +
          `Clone Aptison.Booking next to this one, or write ${TARGET} by hand.`,
      );
    }
    writeFileSync(API_ENV, readFileSync(API_ENV_EXAMPLE, 'utf8'), 'utf8');
    console.log('Copied Aptison.Booking/.env.example to Aptison.Booking/.env');
  }

  const file = readFileSync(API_ENV, 'utf8');
  const current = new RegExp(`^${SECRET_KEY}=(.+)$`, 'm').exec(file);
  if (current !== null) return current[1].trim();

  const secret = randomBytes(32).toString('base64');
  const withSecret = new RegExp(`^${SECRET_KEY}=.*$`, 'm').test(file)
    ? file.replace(new RegExp(`^${SECRET_KEY}=.*$`, 'm'), `${SECRET_KEY}=${secret}`)
    : `${file}${file.endsWith('\n') ? '' : '\n'}${SECRET_KEY}=${secret}\n`;
  writeFileSync(API_ENV, withSecret, 'utf8');

  console.log(
    `Put a new ${SECRET_KEY} in Aptison.Booking/.env.\n` +
      'Run `docker compose up -d keycloak-config-cli` there to give it to Keycloak.',
  );
  return secret;
}

function fail(message) {
  console.error(message);
  process.exit(1);
}
