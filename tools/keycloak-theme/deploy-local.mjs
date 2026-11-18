#!/usr/bin/env node

import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../../', import.meta.url));
const jar = resolve(root, 'dist/apps/koureia-keycloak-theme_keycloak/koureia-keycloak-theme.jar');
const container = process.env.KEYCLOAK_CONTAINER ?? 'keycloak';
const realm = process.env.KEYCLOAK_REALM ?? 'koureia';
const username = process.env.KEYCLOAK_ADMIN_USERNAME ?? 'admin';
const password = process.env.KEYCLOAK_ADMIN_PASSWORD ?? 'admin';
const remoteJar = '/opt/keycloak/providers/koureia-keycloak-theme.jar';

if (!existsSync(jar)) fail(`Theme JAR not found at ${jar}.`);
runDocker(['info'], { quiet: true });
runDocker(['inspect', container], { quiet: true });

const localHash = createHash('sha256').update(readFileSync(jar)).digest('hex');
const remoteHash = runDocker(['exec', container, 'sha256sum', remoteJar], {
  allowFailure: true,
  quiet: true,
})
  .stdout.trim()
  .split(/\s+/)[0];

const installedJar = remoteHash !== localHash;
if (installedJar) {
  runDocker(['cp', jar, `${container}:${remoteJar}`]);
  runDocker(['restart', container]);
  await waitUntilHealthy();
}

authenticate();
// Selected here, not in `realm-export.json`: `keycloak-config-cli` runs at `docker compose up`,
// before this script installs the JAR, and a realm that names an absent theme falls back
// silently for the login pages and fails outright for mail.
const currentRealm = readRealm();
const selectedThemes =
  currentRealm.loginTheme !== 'koureia' || currentRealm.emailTheme !== 'koureia';
if (selectedThemes) {
  runDocker([
    'exec',
    container,
    '/opt/keycloak/bin/kcadm.sh',
    'update',
    `realms/${realm}`,
    '-s',
    'loginTheme=koureia',
    '-s',
    'emailTheme=koureia',
  ]);
}

const configuredRealm = readRealm();
if (configuredRealm.loginTheme !== 'koureia' || configuredRealm.emailTheme !== 'koureia') {
  fail(`Keycloak realm ${realm} did not select the koureia login and email themes.`);
}

// Reported separately, because the two halves come apart: the JAR lives in a container and the
// selection lives in the database.
console.log(
  [
    installedJar
      ? 'Installed the current Koureia theme JAR.'
      : 'Koureia theme JAR was already current.',
    selectedThemes
      ? `Selected the Koureia login and email themes for realm ${realm}.`
      : `Realm ${realm} already selected them.`,
  ].join(' '),
);

function authenticate() {
  // The password goes in over stdin, because anything that reads the process table on this
  // machine can see a `docker exec` argument.
  runDocker(
    [
      'exec',
      '-i',
      container,
      'sh',
      '-c',
      'IFS= read -r password; exec /opt/keycloak/bin/kcadm.sh config credentials' +
        ' --server http://localhost:8080 --realm master --user "$1" --password "$password"',
      'sh',
      username,
    ],
    { input: `${password}\n` },
  );
}

function readRealm() {
  const result = runDocker([
    'exec',
    container,
    '/opt/keycloak/bin/kcadm.sh',
    'get',
    `realms/${realm}`,
    '--fields',
    'realm,loginTheme,emailTheme',
  ]);
  return JSON.parse(result.stdout);
}

async function waitUntilHealthy() {
  const deadline = Date.now() + 120_000;
  while (Date.now() < deadline) {
    const result = runDocker(['inspect', '--format', '{{.State.Health.Status}}', container], {
      allowFailure: true,
      quiet: true,
    });
    if (result.stdout.trim() === 'healthy') return;
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 2_000));
  }
  fail(`Keycloak container ${container} did not become healthy.`);
}

function runDocker(args, options = {}) {
  // `input` attaches to stdio[0], it does not replace it. On `'ignore'` the data goes nowhere and
  // the child reads EOF, which sends kcadm an empty password and returns `invalid_grant`.
  const stdio = options.quiet ? ['pipe', 'pipe', 'pipe'] : ['ignore', 'pipe', 'inherit'];
  if (options.input !== undefined) stdio[0] = 'pipe';

  const result = spawnSync('docker', args, {
    cwd: root,
    encoding: 'utf8',
    ...(options.input === undefined ? {} : { input: options.input }),
    stdio,
    shell: false,
    windowsHide: true,
  });
  if (result.error !== undefined) fail(result.error.message);
  if (result.status !== 0 && !options.allowFailure) {
    fail(result.stderr?.trim() || `docker ${args[0]} failed.`);
  }
  return result;
}

function fail(message) {
  console.error(message);
  process.exit(1);
}
