#!/usr/bin/env node
/**
 * Multi-brand guardrails for the design system.
 *
 * Every check here catches a silent failure: the build succeeds, the current brand looks
 * correct, and the next brand re-themes wrong. A compiler or a test already catches the loud
 * ones.
 *
 * `pnpm lint` runs it. Also `pnpm check:tokens`.
 */
import { readFileSync } from 'node:fs';
import { readdir } from 'node:fs/promises';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));

/** Owns the brand vocabulary, so it is the one place allowed to use it. */
const TOKEN_OWNERS = ['libs/shared/styles', 'libs/themes'];

/**
 * Writes a colour into a document that cannot read a token.
 *
 * A spreadsheet export holds no `var()`, so a hue reaches the workbook as hex or not at all.
 * The application still resolves them off the theme at export time and names none of them; what
 * these two paths cover is that plumbing and the fixtures its specs assert on. Named one by one,
 * so the exemption cannot spread to component styling.
 */
const HEX_FOR_FOREIGN_DOCUMENT = [
  'libs/shared/ui/datagrid/src/core/export/',
  'apps/koureia/src/app/excel-branding',
];

/**
 * A third party's mark in its owner's colours. Like a flag it is artwork with no light or dark
 * variant, and a mark that re-themes is no longer that mark. Named one by one, so the exemption
 * cannot spread to component styling.
 */
const THIRD_PARTY_MARKS = ['libs/features/barbershops/src/shop-map-links/google-maps-mark/'];

/**
 * A spec of a parser that turns the theme's resolved colours into ECharts colours. The browser
 * returns a custom property as the theme writes it, so the parser must read hex, and its spec
 * must feed it hex. Named one by one, so the exemption cannot spread to component styling.
 */
const HEX_PARSER_SPECS = [
  'libs/features/management/analytics/dashboard/src/charts/options/chart-colors.spec.ts',
];

/**
 * The browser chrome color and the installed app's colors. A `<meta name="theme-color">` cannot
 * read a custom property, so the app's document head repeats the theme's `--bg` as hex. Named one
 * by one, so the exemption cannot spread to component styling.
 */
const HEX_FOR_BROWSER_CHROME = ['apps/koureia/src/index.html'];

const SKIP_DIRS = new Set(['node_modules', 'dist', '.angular', '.nx', '.git', 'coverage', 'tmp']);

const CHECKS = [
  {
    id: 'primitive-leak',
    roots: ['libs', 'apps'],
    exts: ['.scss', '.ts', '.html'],
    exclude: TOKEN_OWNERS,
    pattern: /var\(\s*--(?:brand|neutral)-|var\(\s*--paper\s*\)/g,
    why:
      'Reads a primitive ramp instead of a semantic token. Use var(--surface),\n' +
      'var(--accent), var(--text-primary)… A primitive looks right in this brand\n' +
      'and re-themes wrong in the next. If no semantic token fits, add one to\n' +
      'every libs/themes/*/ — it is a cross-brand contract.',
  },
  {
    id: 'primitive-utility',
    roots: ['libs', 'apps'],
    exts: ['.html', '.ts'],
    exclude: TOKEN_OWNERS,
    // Tailwind exposes the ramps as utilities, so `bg-neutral-50` is the same leak as
    // `var(--neutral-50)` with none of the visibility.
    pattern:
      /\b(?:bg|text|border|ring|fill|stroke|from|via|to|divide|outline|decoration|caret|accent)-(?:brand|neutral)-\d+\b/g,
    why:
      'A primitive ramp reached through a Tailwind utility. Same problem as\n' +
      'reading var(--brand-500) directly: use bg-surface, text-primary,\n' +
      'bg-accent, text-accent-text. All utilities are already theme-aware.',
  },
  {
    id: 'hex-literal',
    roots: ['libs', 'apps'],
    // .ts included so an inline `styles:` block cannot bypass this.
    exts: ['.scss', '.ts', '.html'],
    exclude: TOKEN_OWNERS,
    /**
     * A national flag is the one color that must not re-theme. It has no light or dark variant,
     * and a flag that follows the brand accent stops being a flag. It is artwork, not a design
     * decision. Scoped to `flags/` so the exemption cannot spread to component styling.
     *
     * The spreadsheet export is the second, in `HEX_FOR_FOREIGN_DOCUMENT`, and third-party marks
     * the third, in `THIRD_PARTY_MARKS`. The print view, which is also its own document, carries
     * no colour at all and needs no exemption.
     */
    excludeFile: (rel) =>
      rel.includes('/flags/') ||
      HEX_FOR_FOREIGN_DOCUMENT.some((path) => rel.startsWith(path)) ||
      THIRD_PARTY_MARKS.some((path) => rel.startsWith(path)) ||
      HEX_PARSER_SPECS.includes(rel) ||
      HEX_FOR_BROWSER_CHROME.includes(rel),
    // `#{` is Sass interpolation, not a color, so the character class excludes `{`.
    pattern: /#[0-9a-fA-F]{3,8}\b/g,
    why:
      'A hard-coded colour outside the theme packages. Colour belongs in\n' +
      'libs/themes/<brand>/src/_tokens.scss and reaches components as var().',
  },
  {
    id: 'parallel-token-family',
    roots: ['libs', 'apps'],
    exts: ['.scss', '.ts'],
    exclude: TOKEN_OWNERS,
    pattern: /^[ \t]*--(?:dark|on-dark|inverse)-[a-z0-9-]*\s*:/gm,
    why:
      'A parallel token family. A subtree needing different colours is a\n' +
      "surface context — [data-surface='dark'] re-pointing the *existing*\n" +
      'tokens — not a second set of names. A new token earns its place when it\n' +
      'names something the vocabulary lacks (a pairing like --on-warning, a\n' +
      'material like --media-scrim), not when it is "--surface, but over there".',
  },
  {
    id: 'brand-literal',
    // Only shared code. libs/themes/<brand>/ and apps/<brand>/ are a brand's own.
    roots: ['libs/shared', 'libs/features'],
    exts: ['.scss', '.ts', '.html', '.mjs', '.css'],
    // Stories and specs can use invented sample data. Prose that documents the system cannot.
    // READMEs show app-side usage and are excluded too.
    excludeFile: (rel) =>
      rel.endsWith('.stories.ts') || rel.endsWith('.spec.ts') || rel.endsWith('.md'),
    pattern: /koureia/gi,
    why:
      'Names one tenant inside shared code. Koureia is one brand among equals,\n' +
      'not the vendor. Read inject(BRAND) from @util/brand for identity, and put\n' +
      'brand-bearing copy in the app (see LandingBrandCopy). Docstrings count —\n' +
      'they render into Storybook autodocs. Global CSS identifiers count too.',
  },
];

async function* walk(dir) {
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (!SKIP_DIRS.has(entry.name)) yield* walk(full);
    } else if (entry.isFile()) {
      yield full;
    }
  }
}

function lineOf(source, index) {
  return source.slice(0, index).split('\n').length;
}

async function run(check) {
  const findings = [];

  for (const root of check.roots) {
    for await (const file of walk(join(ROOT, root))) {
      const rel = relative(ROOT, file).split(sep).join('/');
      if (!check.exts.some((ext) => rel.endsWith(ext))) continue;
      if (check.exclude?.some((prefix) => rel.startsWith(prefix))) continue;
      if (check.excludeFile?.(rel)) continue;

      const source = readFileSync(file, 'utf8');
      check.pattern.lastIndex = 0;
      for (const match of source.matchAll(check.pattern)) {
        findings.push({
          file: rel,
          line: lineOf(source, match.index),
          text: match[0].trim(),
        });
      }
    }
  }

  return findings;
}

const results = await Promise.all(CHECKS.map(run));
let failed = 0;

for (const [index, check] of CHECKS.entries()) {
  const findings = results[index];
  if (findings.length === 0) {
    console.log(`  ok    ${check.id}`);
    continue;
  }

  failed += 1;
  console.log(`\n  FAIL  ${check.id} — ${findings.length} finding(s)\n`);
  for (const { file, line, text } of findings) {
    console.log(`        ${file}:${line}  ${text}`);
  }
  console.log(`\n${check.why.replace(/^/gm, '        ')}\n`);
}

if (failed > 0) {
  console.error(`\ndesign-token guardrails: ${failed} of ${CHECKS.length} check(s) failed\n`);
  process.exit(1);
}

console.log(`\ndesign-token guardrails: all ${CHECKS.length} checks passed\n`);
