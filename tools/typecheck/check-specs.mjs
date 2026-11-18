#!/usr/bin/env node
/**
 * Type-checks every spec, story and Vite config: each project's `tsconfig.spec.json`.
 *
 * Nothing else does. Vitest strips types without checking them, and `pnpm typecheck` excludes
 * specs. A spec with a type error still passes. Runs TypeScript 7 (`@typescript/native`).
 *
 * `pnpm typecheck:specs`. Pass project paths to check only those:
 * `pnpm typecheck:specs libs/shared/ui/tree`.
 */
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { readdir } from 'node:fs/promises';
import { availableParallelism } from 'node:os';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const TSC = join(ROOT, 'node_modules/@typescript/native/bin/tsc');
const CONFIG = 'tsconfig.spec.json';
const SKIP = new Set(['node_modules', 'dist', 'coverage', '.angular', 'src']);

/** Every directory under `dir` that holds a spec config. A project's `src` is never one. */
async function findConfigs(dir) {
  const found = existsSync(join(dir, CONFIG)) ? [join(dir, CONFIG)] : [];
  const entries = await readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.isDirectory() && !SKIP.has(entry.name) && !entry.name.startsWith('.')) {
      found.push(...(await findConfigs(join(dir, entry.name))));
    }
  }
  return found;
}

function check(config) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [TSC, '--noEmit', '--pretty', 'false', '-p', config], {
      cwd: ROOT,
    });
    let output = '';
    child.stdout.on('data', (chunk) => (output += chunk));
    child.stderr.on('data', (chunk) => (output += chunk));
    child.on('close', (code) => {
      resolve({ config, ok: code === 0, output: output.trim() });
    });
  });
}

/** Runs `task` over `items`, `limit` at a time. One tsc per core would starve the machine. */
async function pool(items, limit, task) {
  const results = [];
  let next = 0;
  const worker = async () => {
    while (next < items.length) {
      const item = items[next++];
      results.push(await task(item));
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}

const requested = process.argv.slice(2);
const configs = requested.length
  ? requested.map((path) => join(ROOT, path, CONFIG))
  : [...(await findConfigs(join(ROOT, 'apps'))), ...(await findConfigs(join(ROOT, 'libs')))];

const missing = configs.filter((config) => !existsSync(config));
if (missing.length > 0) {
  console.error(`No ${CONFIG} in: ${missing.map((c) => relative(ROOT, c)).join(', ')}`);
  process.exit(1);
}

const limit = Math.max(1, Math.floor(availableParallelism() / 2));
console.log(`Type-checking ${configs.length} spec configs, ${limit} at a time...`);

const results = await pool(configs, limit, check);
const failed = results.filter((result) => !result.ok);

for (const result of failed) {
  console.error(`\n✖ ${relative(ROOT, result.config)}\n${result.output}`);
}

if (failed.length > 0) {
  console.error(`\n${failed.length} of ${configs.length} spec configs have type errors.`);
  process.exit(1);
}
console.log(`All ${configs.length} spec configs type-check.`);
