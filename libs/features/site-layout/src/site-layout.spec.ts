import { Component, Injectable } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { provideTransloco, Translation, TranslocoLoader } from '@jsverse/transloco';
import { provideBrand } from '@util/brand';
import { Observable, of } from 'rxjs';

import { withSiteLayout } from './lib.routes';

const FAKE_BRAND = {
  id: 'barbershop-x',
  name: 'Barbershop X',
  wordmark: 'barbershop-x',
  logo: '/brand/barbershop-x-icon.png',
  heroImage: '/images/barbershop-x-hero.webp',
  defaultTheme: 'light',
} as const;

/** Serves the app-owned root keys. The `siteLayout` scope loads through its own loader. */
@Injectable()
class RootTranslocoLoader implements TranslocoLoader {
  getTranslation(): Observable<Translation> {
    return of({
      brand: { landing: { label: 'Barbershop X home page', copyright: '© {{year}} Barbershop X' } },
    });
  }
}

@Component({ selector: 'lib-test-page', template: '<main>page</main>' })
class TestPage {}

describe('Site layout', () => {
  let harness: RouterTestingHarness;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      providers: [
        provideRouter(
          withSiteLayout([
            { path: 'page', component: TestPage },
            {
              path: 'bare',
              data: { siteFooter: false },
              children: [{ path: '', component: TestPage }],
            },
          ]),
        ),
        provideBrand(FAKE_BRAND),
        provideTransloco({
          config: { availableLangs: ['el', 'en'], defaultLang: 'el', fallbackLang: 'en' },
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

  it('renders the site footer below the page', async () => {
    const element = await render('/page');

    const page = element.querySelector('lib-test-page');
    const footer = element.querySelector('lib-site-footer');
    expect(page?.nextElementSibling).toBe(footer);
  });

  it('renders the footer copy before the page is shown', async () => {
    const element = await render('/page');
    const footer = element.querySelector('lib-site-footer');

    expect(footer?.querySelector('nav')?.getAttribute('aria-label')).toBe('Πλοήγηση υποσέλιδου');
    expect(footer?.querySelector('lib-site-brand')?.textContent).toContain('barbershop-x');
    expect(footer?.textContent).toContain(`© ${String(new Date().getFullYear())} Barbershop X`);
  });

  it('prefixes the footer links with the language', async () => {
    const element = await render('/page');

    const hrefs = Array.from(element.querySelectorAll('lib-site-footer nav a')).map((a) =>
      a.getAttribute('href'),
    );
    expect(hrefs).toEqual(['/el', '/el/how-it-works']);
  });

  it('leaves the footer out below a route that opts out', async () => {
    expect((await render('/bare')).querySelector('lib-site-footer')).toBeNull();
    expect((await render('/page')).querySelector('lib-site-footer')).not.toBeNull();
    expect((await render('/bare')).querySelector('lib-site-footer')).toBeNull();
  });
});
