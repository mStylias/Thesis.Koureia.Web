import { Injectable } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { provideTransloco, Translation, TranslocoLoader } from '@jsverse/transloco';
import { provideBrand } from '@util/brand';
import { of, Observable } from 'rxjs';
import { landingRoutes } from './lib.routes';
import type { LandingBrandCopy } from './landing.i18n';

/**
 * A brand that is deliberately nothing like the one this repo ships. Every
 * value below must reach the rendered page, and the word "Koureia" must not —
 * that is what proves the library carries no brand of its own.
 */
const FAKE_BRAND = {
  id: 'barbershop-x',
  name: 'Barbershop X',
  wordmark: 'barbershop-x',
  logo: '/brand/barbershop-x-icon.png',
  heroImage: '/images/barbershop-x-hero.webp',
  defaultTheme: 'light',
} as const;

const FAKE_BRAND_COPY: LandingBrandCopy = {
  label: 'Barbershop X home page',
  howTitle: 'How Barbershop X works',
  ctaTitle: 'We are building Barbershop X with you.',
  copyright: '© {{year}} Barbershop X',
};

/**
 * Serves the app-owned root dictionary. The `landing` scope loads separately
 * through the library's own inline loader, so the real Greek strings still
 * render alongside it.
 */
@Injectable()
class RootTranslocoLoader implements TranslocoLoader {
  getTranslation(): Observable<Translation> {
    return of({ brand: { landing: FAKE_BRAND_COPY } });
  }
}

describe('Landing routes', () => {
  let harness: RouterTestingHarness;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      providers: [
        provideRouter(landingRoutes),
        provideBrand(FAKE_BRAND),
        provideTransloco({
          config: {
            availableLangs: ['el', 'en'],
            defaultLang: 'el',
            fallbackLang: 'en',
          },
          loader: RootTranslocoLoader,
        }),
      ],
    }).compileComponents();

    harness = await RouterTestingHarness.create();
  });

  async function render(url: string): Promise<HTMLElement> {
    await harness.navigateByUrl(url);
    await harness.fixture.whenStable();

    return harness.fixture.nativeElement as HTMLElement;
  }

  it('renders the customer-first home page', async () => {
    const element = await render('/');

    expect(element.querySelector('lib-landing-steps')).not.toBeNull();
    // `/el/…` and not `/…`: every link goes through `[langLink]`, which puts the published
    // language prefix on. `el` is `ActiveLanguage`'s default, and this harness mounts the
    // routes without the `:lang` parent that would otherwise set it.
    expect(element.querySelectorAll('a[href="/el/barbershops"]').length).toBeGreaterThan(0);
  });

  it('prefixes every internal link with a language', async () => {
    // The cheap guard against the failure mode that is invisible when you only ever click
    // in one language: a link that lost its prefix navigates to the 404 instead.
    for (const url of ['/', '/how-it-works']) {
      const element = await render(url);
      const hrefs = Array.from(element.querySelectorAll('a'))
        .map((anchor) => anchor.getAttribute('href'))
        .filter((href): href is string => href?.startsWith('/') === true);

      expect(hrefs.length).toBeGreaterThan(0);
      for (const href of hrefs) {
        expect(href).toMatch(/^\/(el|en|auth)(\/|$)/);
      }
    }
  });

  it('renders owner information on how-it-works', async () => {
    const element = await render('/how-it-works');

    expect(element.querySelector('lib-landing-steps')).not.toBeNull();
    expect(element.querySelector('lib-landing-features')).not.toBeNull();
    expect(element.querySelector('lib-landing-cta')).not.toBeNull();
  });

  it('takes the wordmark, logo and hero image from the injected brand', async () => {
    const element = await render('/');

    const wordmark = element.querySelector('lib-site-brand');
    expect(wordmark?.textContent).toContain(FAKE_BRAND.wordmark);
    expect(wordmark?.querySelector('a')?.getAttribute('aria-label')).toBe(FAKE_BRAND_COPY.label);
    expect(wordmark?.querySelector('img')?.getAttribute('src')).toContain(FAKE_BRAND.logo);

    expect(element.querySelector('.hero-image')?.getAttribute('src')).toContain(
      FAKE_BRAND.heroImage,
    );
  });

  it('takes brand-bearing copy from the app-owned root keys', async () => {
    const how = await render('/how-it-works');
    expect(how.querySelector('#how-title')?.textContent.trim()).toBe(FAKE_BRAND_COPY.howTitle);
    expect(how.querySelector('#cta-title')?.textContent.trim()).toBe(FAKE_BRAND_COPY.ctaTitle);
  });

  it('leaks no hardcoded brand of its own', async () => {
    for (const url of ['/', '/how-it-works']) {
      const element = await render(url);

      // Catches a reintroduced literal in a template, a dictionary or an asset
      // path — the failure mode this whole phase exists to prevent.
      expect(element.innerHTML.toLowerCase()).not.toContain('koureia');
    }
  });
});
