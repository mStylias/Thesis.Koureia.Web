#!/usr/bin/env node

import { chmodSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { delimiter, join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../../', import.meta.url));
const keycloakify = resolve(root, 'node_modules/keycloakify/bin/main.js');
const hideChildWindows = resolve(root, 'tools/keycloak-theme/hide-child-windows.cjs');
const windowsDirRename = resolve(root, 'tools/keycloak-theme/windows-dir-rename.cjs');
const args = [keycloakify, 'build', '--project', 'apps/koureia-keycloak-theme'];
const env = {
  ...process.env,
  KEYCLOAKIFY_BUILD_FOR_KEYCLOAK_MAJOR_VERSION: '26',
  NODE_OPTIONS: [
    process.env.NODE_OPTIONS,
    requireOption(hideChildWindows),
    requireOption(windowsDirRename),
  ]
    .filter(Boolean)
    .join(' '),
};
const wrapperDirectory = mkdtempSync(join(tmpdir(), 'koureia-keycloak-build-'));

try {
  createViteRunnerWrapper(wrapperDirectory);
  // Set KOUREIA_KEYCLOAK_MAVEN=docker when local Maven cannot reach Maven Central, for example
  // when an antivirus intercepts TLS with a certificate the JDK truststore does not know.
  const forceDockerMaven = process.env.KOUREIA_KEYCLOAK_MAVEN === 'docker';
  const localMaven = forceDockerMaven ? undefined : findMaven();
  const useDockerMaven = localMaven === undefined;
  if (useDockerMaven) {
    if (!hasDocker()) {
      fail(
        forceDockerMaven
          ? 'KOUREIA_KEYCLOAK_MAVEN=docker is set but the Docker engine is not running.'
          : 'The Keycloak theme JAR needs Apache Maven or a running Docker engine.',
      );
    }
    createDockerMavenWrapper(wrapperDirectory);
  } else if (process.platform === 'win32') {
    createLocalMavenWrapper(wrapperDirectory, localMaven);
  }
  run(
    process.execPath,
    args,
    prependToPath(
      {
        ...env,
        ...(useDockerMaven ? { KEYCLOAKIFY_USE_DEFAULT_MAVEN_REPO: 'true' } : {}),
      },
      wrapperDirectory,
    ),
  );
} finally {
  rmSync(wrapperDirectory, { recursive: true, force: true });
}

/**
 * A `--require` that survives a workspace path with a space in it.
 *
 * Node splits `NODE_OPTIONS` on whitespace, so an unquoted path with a space becomes two
 * arguments. Quotes fix that, but Node also treats `\` as an escape inside a quoted value, so
 * `\repos` arrives as `repos`. Windows accepts forward slashes, which have neither problem.
 */
function requireOption(path) {
  return `--require="${path.replaceAll('\\', '/')}"`;
}

// Windows spells the variable `Path`, so an `env.PATH` read misses it and a `PATH:` write leaves
// the child with two conflicting entries.
function prependToPath(environment, directory) {
  const keys = Object.keys(environment).filter((key) => /^path$/i.test(key));
  const current = keys.map((key) => environment[key]).find(Boolean) ?? '';
  const next = { ...environment };
  for (const key of keys) delete next[key];
  next[keys[0] ?? 'PATH'] = current ? `${directory}${delimiter}${current}` : directory;
  return next;
}

function findMaven() {
  const command = process.platform === 'win32' ? (process.env.ComSpec ?? 'cmd.exe') : 'mvn';
  const args = process.platform === 'win32' ? ['/d', '/s', '/c', 'mvn --version'] : ['--version'];
  const result = spawnSync(command, args, {
    encoding: 'utf8',
    shell: false,
    windowsHide: true,
  });
  if (result.status !== 0 || !result.stdout.includes('Apache Maven')) {
    return undefined;
  }

  if (process.platform !== 'win32') {
    return 'mvn';
  }

  const lookup = spawnSync('where.exe', ['mvn'], {
    encoding: 'utf8',
    shell: false,
    windowsHide: true,
  });
  const candidates = lookup.stdout
    .split(/\r?\n/)
    .map((path) => path.trim())
    .filter(Boolean);
  return candidates.find((path) => path.toLowerCase().endsWith('.cmd')) ?? candidates[0];
}

function hasDocker() {
  return (
    spawnSync('docker', ['info'], {
      stdio: 'ignore',
      shell: false,
      windowsHide: true,
    }).status === 0
  );
}

function createViteRunnerWrapper(directory) {
  const vite = resolve(root, 'node_modules/vite/bin/vite.js');
  if (process.platform === 'win32') {
    writeFileSync(
      join(directory, 'npx.cmd'),
      ['@echo off', `"${process.execPath}" "${vite}"`, ''].join('\r\n'),
      'utf8',
    );
    return;
  }

  const path = join(directory, 'npx');
  writeFileSync(path, ['#!/usr/bin/env sh', `exec "${process.execPath}" "${vite}"`, ''].join('\n'));
  chmodSync(path, 0o755);
}

function createLocalMavenWrapper(directory, maven) {
  writeFileSync(
    join(directory, 'mvn.cmd'),
    ['@echo off', `call "${maven}" %*`, ''].join('\r\n'),
    'utf8',
  );
}

function createDockerMavenWrapper(directory) {
  if (process.platform === 'win32') {
    const path = join(directory, 'mvn.cmd');
    writeFileSync(
      path,
      [
        '@echo off',
        'docker run --rm --mount type=bind,source="%CD%",target=/workspace --mount source=koureia-keycloak-maven-cache,target=/root/.m2 --workdir /workspace maven:3.9.11-eclipse-temurin-21 mvn %*',
        '',
      ].join('\r\n'),
      'utf8',
    );
    return path;
  }

  const path = join(directory, 'mvn');
  writeFileSync(
    path,
    [
      '#!/usr/bin/env sh',
      'exec docker run --rm --mount "type=bind,source=$PWD,target=/workspace" --mount source=koureia-keycloak-maven-cache,target=/root/.m2 --workdir /workspace maven:3.9.11-eclipse-temurin-21 mvn "$@"',
      '',
    ].join('\n'),
    'utf8',
  );
  chmodSync(path, 0o755);
  return path;
}

function run(command, commandArgs, commandEnv) {
  const result = spawnSync(command, commandArgs, {
    cwd: root,
    env: commandEnv,
    stdio: 'inherit',
    shell: false,
    windowsHide: true,
  });
  if (result.error !== undefined) fail(result.error.message);
  if (result.status !== 0) process.exit(result.status ?? 1);
}

function fail(message) {
  console.error(message);
  process.exit(1);
}
