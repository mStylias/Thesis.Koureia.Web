import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { Translation, TranslocoLoader, provideTransloco } from '@jsverse/transloco';
import { provideBrand } from '@util/brand';
import { activateLanguage, languageMatches, PAGE_META, type PageMeta } from '@util/language';

import { PageMetadata } from './page-metadata';

@Component({ template: '' })
class Blank {}

const SHOP_META: PageMeta = {
  title: 'Barber House Κολωνάκι',
  description: 'Κλασικό κουρείο στο Κολωνάκι.',
  image: 'https://images.test/main.jpg',
  indexable: true,
};

const MISSING_SHOP_META: PageMeta = {
  title: 'Το κουρείο δεν βρέθηκε',
  description: null,
  image: null,
  indexable: false,
};

const DICTIONARIES: Record<string, Translation> = {
  el: {
    titles: { home: 'Αρχική', barbershops: 'Κουρεία', notFound: 'Δεν βρέθηκε' },
    descriptions: { home: 'Ελληνική περιγραφή', barbershops: 'Κουρεία περιγραφή' },
  },
  en: {
    titles: { home: 'Home', barbershops: 'Barbershops', notFound: 'Not found' },
    descriptions: { home: 'English description', barbershops: 'Barbershops description' },
  },
};

class StubLoader implements TranslocoLoader {
  getTranslation(lang: string): Promise<Translation> {
    return Promise.resolve(DICTIONARIES[lang] ?? {});
  }
}

async function render(url: string): Promise<RouterTestingHarness> {
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    providers: [
      provideRouter([
        {
          path: ':lang',
          canMatch: [languageMatches],
          resolve: { lang: activateLanguage },
          children: [
            {
              path: 'barbershops/missing',
              component: Blank,
              data: { [PAGE_META]: MISSING_SHOP_META },
            },
            { path: 'barbershops/:slug', component: Blank, data: { [PAGE_META]: SHOP_META } },
            {
              path: 'barbershops',
              component: Blank,
              title: 'titles.barbershops',
              data: { description: 'descriptions.barbershops' },
            },
            {
              path: '',
              component: Blank,
              title: 'titles.home',
              data: { description: 'descriptions.home' },
            },
          ],
        },
        { path: '**', component: Blank, title: 'titles.notFound' },
      ]),
      provideTransloco({
        config: { availableLangs: ['el', 'en'], defaultLang: 'el', fallbackLang: 'en' },
        loader: StubLoader,
      }),
      provideBrand({
        id: 'koureia',
        name: 'Koureia',
        wordmark: 'koureia',
        logo: '/brand/koureia_icon.png',
        heroImage: '/images/hero.webp',
        defaultTheme: 'system',
      }),
    ],
  });

  // Subscribed before the navigation, exactly as the app initializer does it.
  TestBed.inject(PageMetadata).start();
  return RouterTestingHarness.create(url);
}

function head(): HTMLHeadElement {
  return document.head;
}

/**
 * jsdom's `<head>` outlives a TestBed reset, so each test starts from a clean one. Without
 * this, a tag left by the previous test could stand in for one this test never wrote.
 */
beforeEach(() => {
  for (const element of Array.from(
    head().querySelectorAll(
      'link[rel="canonical"], link[rel="alternate"], meta[name="description"], meta[name="robots"], meta[property^="og:"]',
    ),
  )) {
    element.remove();
  }
  document.documentElement.removeAttribute('lang');
});

function link(rel: string, hreflang?: string): string | null {
  const match = Array.from(head().querySelectorAll('link')).find(
    (element) =>
      element.getAttribute('rel') === rel &&
      element.getAttribute('hreflang') === (hreflang ?? null),
  );
  return match?.getAttribute('href') ?? null;
}

function meta(nameOrProperty: string): string | null {
  const attribute = nameOrProperty.startsWith('og:') ? 'property' : 'name';
  return (
    head().querySelector(`meta[${attribute}="${nameOrProperty}"]`)?.getAttribute('content') ?? null
  );
}

describe('PageMetadata', () => {
  describe('on a Greek public page', () => {
    beforeEach(async () => {
      await render('/el/barbershops');
    });

    it('declares the language of the address it is served at', () => {
      expect(document.documentElement.lang).toBe('el');
    });

    it('describes itself in Greek', () => {
      expect(meta('description')).toBe('Κουρεία περιγραφή');
      expect(meta('og:description')).toBe('Κουρεία περιγραφή');
    });

    it('names the brand in the OG title', () => {
      expect(meta('og:title')).toBe('Κουρεία | Koureia');
    });

    it('points its canonical at itself, not at the other language', () => {
      expect(link('canonical')).toBe('https://koureia.gr/el/barbershops');
      expect(meta('og:url')).toBe('https://koureia.gr/el/barbershops');
    });

    it('names every language reciprocally, including itself', () => {
      expect(link('alternate', 'el')).toBe('https://koureia.gr/el/barbershops');
      expect(link('alternate', 'en')).toBe('https://koureia.gr/en/barbershops');
    });

    it('points x-default at the negotiating root', () => {
      expect(link('alternate', 'x-default')).toBe('https://koureia.gr/');
    });

    it('states the OG locale and its alternate', () => {
      expect(meta('og:locale')).toBe('el_GR');
      expect(meta('og:locale:alternate')).toBe('en_US');
    });

    it('does not ask to be left out of the index', () => {
      expect(meta('robots')).toBeNull();
    });
  });

  describe('on the same page in English', () => {
    beforeEach(async () => {
      await render('/en/barbershops');
    });

    it('serves the English dictionary at the English address', () => {
      expect(document.documentElement.lang).toBe('en');
      expect(meta('description')).toBe('Barbershops description');
    });

    it('names the same alternates as the Greek page — reciprocity by construction', () => {
      expect(link('alternate', 'el')).toBe('https://koureia.gr/el/barbershops');
      expect(link('alternate', 'en')).toBe('https://koureia.gr/en/barbershops');
      expect(link('alternate', 'x-default')).toBe('https://koureia.gr/');
    });
  });

  describe('on a language home page', () => {
    it('treats `/el` as the page and does not emit a trailing slash', async () => {
      await render('/el');
      expect(link('canonical')).toBe('https://koureia.gr/el');
      expect(meta('description')).toBe('Ελληνική περιγραφή');
    });
  });

  describe('on an address nobody published', () => {
    beforeEach(async () => {
      await render('/foo');
    });

    it('asks to be left out of the index', () => {
      expect(meta('robots')).toBe('noindex, follow');
    });

    it('claims no canonical — a 404 that names one is worse than one that names none', () => {
      expect(link('canonical')).toBeNull();
      expect(meta('og:url')).toBeNull();
    });

    it('claims no alternates', () => {
      expect(link('alternate', 'el')).toBeNull();
      expect(link('alternate', 'en')).toBeNull();
      expect(link('alternate', 'x-default')).toBeNull();
    });

    it('describes nothing rather than shipping an untranslated key', () => {
      expect(meta('description')).toBeNull();
    });
  });

  describe('leaving a public page for a 404', () => {
    it('withdraws the canonical it had emitted, rather than leaving it stale', async () => {
      const harness = await render('/el/barbershops');
      expect(link('canonical')).not.toBeNull();

      await harness.navigateByUrl('/foo');

      expect(link('canonical')).toBeNull();
      expect(link('alternate', 'el')).toBeNull();
      expect(meta('robots')).toBe('noindex, follow');
    });
  });

  describe('on a page built from data', () => {
    beforeEach(async () => {
      await render('/el/barbershops/barber-house-kolonaki');
    });

    it('describes itself with its own literal copy, not a dictionary key', () => {
      expect(meta('description')).toBe('Κλασικό κουρείο στο Κολωνάκι.');
      expect(meta('og:title')).toBe('Barber House Κολωνάκι | Koureia');
    });

    it('shares its own image', () => {
      expect(meta('og:image')).toBe('https://images.test/main.jpg');
    });

    it('is published under its own address in both languages', () => {
      expect(link('canonical')).toBe('https://koureia.gr/el/barbershops/barber-house-kolonaki');
      expect(link('alternate', 'en')).toBe(
        'https://koureia.gr/en/barbershops/barber-house-kolonaki',
      );
      expect(meta('robots')).toBeNull();
    });
  });

  describe('on a page built from data that is not published', () => {
    beforeEach(async () => {
      await render('/el/barbershops/missing');
    });

    it('is kept out of the index, with no canonical and no image', () => {
      expect(meta('robots')).toBe('noindex, follow');
      expect(link('canonical')).toBeNull();
      expect(meta('og:image')).toBeNull();
      expect(meta('og:title')).toBe('Το κουρείο δεν βρέθηκε | Koureia');
    });
  });
});
