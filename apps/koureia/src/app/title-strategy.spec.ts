import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Title } from '@angular/platform-browser';
import { provideRouter, TitleStrategy } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { provideTransloco, Translation, TranslocoLoader } from '@jsverse/transloco';
import { provideBrand } from '@util/brand';
import { PAGE_META, type PageMeta } from '@util/language';

import { AppTitleStrategy } from './title-strategy';

@Component({ template: '' })
class Blank {}

class StubLoader implements TranslocoLoader {
  getTranslation(): Promise<Translation> {
    return Promise.resolve({ titles: { barbershops: 'Κουρεία' } });
  }
}

const SHOP_META: PageMeta = {
  title: 'Barber House Κολωνάκι',
  description: null,
  image: null,
  indexable: true,
};

async function titleAt(url: string): Promise<string> {
  TestBed.configureTestingModule({
    providers: [
      provideRouter([
        {
          path: 'shop',
          component: Blank,
          title: 'titles.ignored',
          data: { [PAGE_META]: SHOP_META },
        },
        { path: 'list', component: Blank, title: 'titles.barbershops' },
      ]),
      { provide: TitleStrategy, useClass: AppTitleStrategy },
      provideTransloco({
        config: { availableLangs: ['el'], defaultLang: 'el' },
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
  const harness = await RouterTestingHarness.create(url);
  await harness.fixture.whenStable();
  return TestBed.inject(Title).getTitle();
}

describe('AppTitleStrategy', () => {
  it('translates a route title key', async () => {
    await expect(titleAt('/list')).resolves.toBe('Κουρεία | Koureia');
  });

  it('uses the literal title of a page built from data', async () => {
    await expect(titleAt('/shop')).resolves.toBe('Barber House Κολωνάκι | Koureia');
  });
});
