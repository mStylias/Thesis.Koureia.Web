#!/usr/bin/env node
/**
 * Asserts what only the built output can prove about language routing. A unit test has a
 * different order and a different DOM, so these three failures stay invisible to one.
 *
 * - A missed link drops the language. The unprefixed target lands on the 404, and nobody who
 *   browses in one language sees it. So every internal `href` in every page is checked.
 * - A language set too late bakes the wrong dictionary into a file, which reads as a
 *   translation bug. Only a Greek page that contains Greek proves the order.
 * - Broken `hreflang` reciprocity is ignored silently by Google.
 *
 * Run after `nx build koureia`: `node tools/seo/check-prerender.mjs`.
 */
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

const DIST = 'dist/apps/koureia/browser';
const ORIGIN = 'https://koureia.gr';
const LANGUAGES = ['el', 'en'];
// `PRERENDERED_PAGE_PATHS`, repeated: this script reads the built output and cannot import TS.
// A page listed in `SERVER_RENDERED_PAGE_PATHS` writes no file, so listing it here fails here.
const PAGES = ['', 'how-it-works'];

// A page in the right language contains text only that language has. Greek is its alphabet.
// English is a word the Greek dictionary never uses.
const LANGUAGE_EVIDENCE = {
  el: /[Ͱ-Ͽ]/,
  en: /\b(Barbershops|How it works|Book)\b/i,
};

const failures = [];

function fail(file, message) {
  failures.push(`${file}: ${message}`);
}

function headOf(html) {
  const end = html.indexOf('</head>');
  return end === -1 ? html : html.slice(0, end);
}

function bodyOf(html) {
  const start = html.indexOf('<body');
  return start === -1 ? html : html.slice(start);
}

function attribute(tag, name) {
  return new RegExp(`${name}="([^"]*)"`).exec(tag)?.[1] ?? null;
}

for (const language of LANGUAGES) {
  for (const page of PAGES) {
    const path = page === '' ? language : `${language}/${page}`;
    const file = join(DIST, path, 'index.html');

    let html;
    try {
      html = await readFile(file, 'utf8');
    } catch {
      fail(file, 'was not prerendered — the manifest and PRERENDERED_PAGE_PATHS disagree');
      continue;
    }

    const head = headOf(html);
    const address = `${ORIGIN}/${path}`;

    // An English page that claims to be Greek undermines every other signal.
    const lang = attribute(/<html[^>]*>/.exec(head)?.[0] ?? '', 'lang');
    if (lang !== language) fail(path, `<html lang> is "${lang}", expected "${language}"`);

    // The dictionary the render actually loaded.
    if (!LANGUAGE_EVIDENCE[language].test(html)) {
      fail(path, `rendered no ${language} text — the language was set after a child resolver`);
    }

    // A self-referencing canonical, or the two languages read as duplicates.
    const canonical = attribute(/<link rel="canonical"[^>]*>/.exec(head)?.[0] ?? '', 'href');
    if (canonical !== address) {
      fail(path, `canonical is "${canonical}", expected "${address}"`);
    }

    // Reciprocity: the page must name every language, itself and x-default included.
    const alternates = new Map(
      [...head.matchAll(/<link rel="alternate"[^>]*>/g)].map((match) => [
        attribute(match[0], 'hreflang'),
        attribute(match[0], 'href'),
      ]),
    );

    for (const other of LANGUAGES) {
      const expected = page === '' ? `${ORIGIN}/${other}` : `${ORIGIN}/${other}/${page}`;
      if (alternates.get(other) !== expected) {
        fail(path, `hreflang="${other}" is "${alternates.get(other)}", expected "${expected}"`);
      }
    }
    if (alternates.get('x-default') !== `${ORIGIN}/`) {
      fail(path, `hreflang="x-default" is "${alternates.get('x-default')}", expected "${ORIGIN}/"`);
    }

    const description = attribute(
      /<meta name="description"[^>]*>/.exec(head)?.[0] ?? '',
      'content',
    );
    if (description === null || description === '') {
      fail(path, 'has no <meta name="description">');
    } else if (description.startsWith('descriptions.')) {
      fail(path, `description is the untranslated key "${description}"`);
    }

    // Every internal link must carry a language. Only `/auth` never does.
    for (const match of bodyOf(html).matchAll(/<a [^>]*href="(\/[^"]*)"/g)) {
      const href = match[1];
      if (!/^\/(el|en|auth)(\/|$|\?|#)/.test(href)) {
        fail(path, `internal link "${href}" has no language prefix`);
      }
    }
  }
}

if (failures.length > 0) {
  console.error(`\n✖ ${failures.length} prerender check(s) failed:\n`);
  for (const failure of failures) console.error(`  - ${failure}`);
  console.error('');
  process.exit(1);
}

console.log(
  `✔ ${LANGUAGES.length * PAGES.length} prerendered pages pass the language and SEO checks`,
);
