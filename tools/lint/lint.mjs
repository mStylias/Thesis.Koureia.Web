#!/usr/bin/env node
/**
 * Lints the workspace: Oxlint on TypeScript and JavaScript, ESLint on Angular templates, and the
 * design-token guardrails (`tools/design-tokens/check-tokens.mjs`).
 *
 * Oxlint cannot parse Angular templates, so ESLint checks `.html` files and inline templates only.
 * The three run in parallel. Each one prints its output when it ends, so the outputs do not mix.
 *
 * `pnpm lint`. `pnpm lint:fix` passes `--fix` to Oxlint and ESLint.
 */
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const fix = process.argv.includes('--fix');

const checks = [
  {
    name: 'oxlint',
    command: 'oxlint --type-aware --report-unused-disable-directives',
    fixable: true,
  },
  { name: 'eslint', command: 'eslint apps libs --report-unused-disable-directives', fixable: true },
  { name: 'tokens', command: 'node tools/design-tokens/check-tokens.mjs', fixable: false },
];

function run({ name, command, fixable }) {
  return new Promise((resolve) => {
    const started = performance.now();
    // A shell finds the `.cmd` shims in `node_modules/.bin` on Windows.
    const child = spawn(fix && fixable ? `${command} --fix` : command, { cwd: ROOT, shell: true });
    let output = '';
    child.stdout.on('data', (chunk) => (output += chunk));
    child.stderr.on('data', (chunk) => (output += chunk));
    child.on('close', (code) => {
      const seconds = ((performance.now() - started) / 1000).toFixed(1);
      resolve({ name, ok: code === 0, output: output.trim(), seconds });
    });
  });
}

const results = await Promise.all(checks.map(run));

for (const result of results) {
  console.log(`\n${result.ok ? '✔' : '✖'} ${result.name} (${result.seconds}s)`);
  if (result.output) console.log(result.output);
}

process.exit(results.every((result) => result.ok) ? 0 : 1);
