import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
  type TestRequest,
} from '@angular/common/http/testing';
import { ApplicationRef, Injectable, RESPONSE_INIT } from '@angular/core';
import { DeferBlockState, TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import {
  provideTransloco,
  Translation,
  TranslocoLoader,
  TranslocoService,
} from '@jsverse/transloco';
import { provideBrand } from '@util/brand';
import { readPageMeta } from '@util/language';
import { firstValueFrom, Observable, of } from 'rxjs';

import type { CompanyDetailsResponse } from '../data/barbershops.api.types';
import { barbershopsRoutes } from '../lib.routes';
import { bookingOptions } from '../barbershop-booking/booking.fixture';
import { companyDetails, companyPhotos } from './barbershop-home.fixture';

const mapLibreMock = vi.hoisted(() => ({ construct: vi.fn() }));

vi.mock('maplibre-gl', () => {
  class Map {
    readonly container: HTMLElement;

    constructor(options: { container: HTMLElement }) {
      mapLibreMock.construct(options);
      this.container = options.container;
    }

    addControl(): this {
      return this;
    }

    once(event: string, listener: () => void): this {
      if (event === 'load') queueMicrotask(listener);
      return this;
    }

    fitBounds(): this {
      return this;
    }

    easeTo(): this {
      return this;
    }

    remove(): void {
      // Nothing to release.
    }
  }

  class Marker {
    constructor(private readonly options: { element: HTMLElement }) {}

    setLngLat(): this {
      return this;
    }

    addTo(map: Map): this {
      map.container.append(this.options.element);
      return this;
    }

    remove(): this {
      this.options.element.remove();
      return this;
    }
  }

  function NavigationControl(): object {
    return {};
  }

  return { Map, Marker, NavigationControl, setWorkerUrl: vi.fn() };
});

// jsdom has no `IntersectionObserver`, which `@defer (on viewport)` needs, and no `<dialog>`
// methods, which the gallery's viewer needs.
beforeAll(() => {
  globalThis.IntersectionObserver = class {
    observe(): void {
      // Never fires. A test renders the deferred map by hand.
    }
    unobserve(): void {
      // Nothing observed.
    }
    disconnect(): void {
      // Nothing observed.
    }
  } as unknown as typeof IntersectionObserver;

  HTMLDialogElement.prototype.showModal = function (this: HTMLDialogElement) {
    this.open = true;
  };
  HTMLDialogElement.prototype.close = function (this: HTMLDialogElement) {
    this.open = false;
    this.dispatchEvent(new Event('close'));
  };
});

/** The app's root keys the page head reads. The scope's own strings come from its loader. */
const ROOT: Translation = {
  titles: { barbershops: 'Κουρεία', barbershopNotFound: 'Το κουρείο δεν βρέθηκε' },
  descriptions: { barbershop: '{{name}}, {{area}}: δες υπηρεσίες.' },
};

@Injectable()
class RootLoader implements TranslocoLoader {
  getTranslation(lang: string): Observable<Translation> {
    return of(lang === 'el' ? ROOT : {});
  }
}

/** The booking page namespaces its draft keys by brand, so one has to be registered. */
const FAKE_BRAND = {
  id: 'barbershop-x',
  name: 'Barbershop X',
  wordmark: 'barbershop-x',
  logo: '/brand/barbershop-x-icon.png',
  heroImage: '/images/barbershop-x-hero.webp',
  defaultTheme: 'light',
} as const;

const SLUG = 'barber-house-kolonaki';

describe('Barbershop home route', () => {
  let harness: RouterTestingHarness;
  let http: HttpTestingController;
  let response: ResponseInit;

  beforeEach(async () => {
    vi.clearAllMocks();
    response = { status: 200, headers: new Headers() };

    await TestBed.configureTestingModule({
      providers: [
        provideRouter(barbershopsRoutes),
        provideBrand(FAKE_BRAND),
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: RESPONSE_INIT, useValue: response },
        provideTransloco({
          config: { availableLangs: ['el', 'en'], defaultLang: 'el', fallbackLang: 'en' },
          loader: RootLoader,
        }),
      ],
    }).compileComponents();

    // In the app, `activateLanguage` on the `:lang` parent loads the root dictionary first.
    await firstValueFrom(TestBed.inject(TranslocoService).load('el'));

    harness = await RouterTestingHarness.create();
    http = TestBed.inject(HttpTestingController);
  });

  function element(): HTMLElement {
    return harness.fixture.nativeElement as HTMLElement;
  }

  function query(selector: string): HTMLElement {
    const found = element().querySelector<HTMLElement>(selector);
    if (found === null) throw new Error(`${selector} not rendered`);
    return found;
  }

  function texts(selector: string): string[] {
    return Array.from(element().querySelectorAll(selector)).map((node) =>
      node.textContent.trim().replace(/\s+/g, ' '),
    );
  }

  /** Opens the page and answers its one request, with a shop or with an error status. */
  async function open(answer: CompanyDetailsResponse | number = companyDetails()): Promise<void> {
    const navigation = harness.navigateByUrl(`/${SLUG}`);
    let request: TestRequest | undefined;
    await vi.waitFor(() => {
      request = http.expectOne((candidate) => candidate.url.endsWith(`/companies/${SLUG}`));
    });
    if (typeof answer === 'number') {
      request?.flush({ errorCode: 'X' }, { status: answer, statusText: 'Error' });
    } else {
      request?.flush(answer);
    }
    await navigation;
    await harness.fixture.whenStable();
    harness.detectChanges();
  }

  it('asks for the shop by its slug, in the page language', async () => {
    const navigation = harness.navigateByUrl(`/${SLUG}`);
    await vi.waitFor(() => {
      http
        .expectOne((candidate) =>
          candidate.urlWithParams.endsWith(`/companies/${SLUG}?languageCode=el`),
        )
        .flush(companyDetails());
    });
    await navigation;
    harness.detectChanges();

    expect(query('h1').textContent.trim()).toBe('Barber House Κολωνάκι');
  });

  it('puts the address, the neighborhood and the rating under the title', async () => {
    await open();

    expect(query('.hero__place').textContent.replace(/\s+/g, ' ').trim()).toBe(
      'Σκουφά 28 • Κολωνάκι',
    );
    expect(texts('.rating__visible > span, .rating__visible > strong')).toEqual([
      '★',
      '4,7',
      '(128 κριτικές)',
    ]);
    // The star is hidden from a screen reader, which hears one sentence instead.
    expect(query('.rating__visible').getAttribute('aria-hidden')).toBe('true');
    expect(query('.rating .sr-only').textContent.trim()).toBe(
      'Βαθμολογία 4,7 στα 5, από 128 κριτικές',
    );
  });

  it('names the city when the shop has no neighborhood', async () => {
    await open(companyDetails({ neighborhood: null }));

    expect(query('.hero__place').textContent).toContain('Σκουφά 28 • Αθήνα');
  });

  it('labels a shop "Νέο" until the API reports an average', async () => {
    await open(companyDetails({ rating: { count: 3, average: null } }));

    expect(query('.rating--new').textContent.trim()).toBe('Νέο');
    expect(element().querySelector('.rating__visible')).toBeNull();
  });

  it('leads to the booking page', async () => {
    await open();

    const cta = query('.hero__cta');
    expect(cta.getAttribute('href')).toBe(`/el/barbershops/${SLUG}/booking`);
    expect(cta.textContent.trim()).toBe('Κλείσε ραντεβού');
  });

  it('scrolls down to the map from the top of the page', async () => {
    await open();
    const location = query('.shop-section--location');
    const scroll = vi.fn();
    location.scrollIntoView = scroll;
    // jsdom has no `matchMedia`.
    vi.stubGlobal('matchMedia', () => ({ matches: false }));

    const button = query('.hero__map');
    expect(button.textContent.trim()).toBe('Δες το στο χάρτη');
    button.click();

    expect(scroll).toHaveBeenCalledExactlyOnceWith({ behavior: 'smooth', block: 'start' });
    vi.unstubAllGlobals();
  });

  it('repeats the booking action below the services and below the Google Maps link', async () => {
    await open();

    const ctas = element().querySelectorAll('.shop-section__cta');
    expect(ctas).toHaveLength(2);
    expect(ctas[0].closest('.shop-section--services')).not.toBeNull();
    expect(ctas[1].closest('.location__card')?.lastElementChild).toBe(ctas[1]);
    for (const cta of ctas) {
      expect(cta.getAttribute('href')).toBe(`/el/barbershops/${SLUG}/booking`);
      expect(cta.textContent.trim()).toBe('Κλείσε ραντεβού');
    }
  });

  describe('gallery', () => {
    function galleryImages(): (string | null)[] {
      return Array.from(element().querySelectorAll('.gallery__strip img')).map((image) =>
        image.getAttribute('src'),
      );
    }

    it('opens on the main photo, then the other photos in order, and leaves the logo out', async () => {
      await open();

      expect(galleryImages()).toEqual([
        'https://images.test/photo-1.jpg',
        'https://images.test/photo-2.jpg',
        'https://images.test/photo-3.jpg',
      ]);
    });

    it('shows the logo beside the name', async () => {
      await open();

      expect(element().querySelector('.hero__logo')?.getAttribute('src')).toBe(
        'https://images.test/logo.png',
      );
    });

    it('shows no logo when the shop has none', async () => {
      await open(companyDetails({ logoUrl: null, photos: companyPhotos(2) }));

      expect(element().querySelector('.hero__logo')).toBeNull();
      expect(galleryImages()).toHaveLength(2);
    });

    it('shows a placeholder when the shop has no photo at all', async () => {
      await open(companyDetails({ logoUrl: null, photos: [] }));

      expect(element().querySelector('lib-gallery')).toBeNull();
      expect(element().querySelector('.hero__placeholder')).not.toBeNull();
    });
  });

  describe('services', () => {
    it('groups them by category, with the uncategorized ones last', async () => {
      await open();

      expect(texts('.services-group__title')).toEqual(['Κούρεμα', 'Γένια', 'Άλλες υπηρεσίες']);
      expect(texts('.service__name')).toEqual([
        'Ανδρικό κούρεμα',
        'Παιδικό κούρεμα',
        'Περιποίηση γενιών',
        'Λούσιμο',
      ]);
    });

    it('shows each base price and duration in the page language', async () => {
      await open();

      expect(texts('.service__price')).toEqual(['15 €', '12,50 €', '10 €', '5 €']);
      expect(texts('.service__duration')).toEqual([
        '30 λεπτά',
        '1 ώρα 15 λεπτά',
        '1 ώρα',
        '10 λεπτά',
      ]);
    });

    it('drops the headings when no service has a category', async () => {
      await open(companyDetails({ serviceCategories: [] }));

      expect(element().querySelector('.services-group__title')).toBeNull();
      expect(texts('.service__name')).toEqual(['Λούσιμο']);
    });

    it('leaves the section out when there is no service', async () => {
      await open(companyDetails({ serviceCategories: [], uncategorizedServices: [] }));

      expect(element().querySelector('lib-barbershop-services')).toBeNull();
      expect(element().querySelector('#shop-services-title')).toBeNull();
    });
  });

  describe('barbers', () => {
    it('shows the photo when there is one and the initials when there is not', async () => {
      await open();

      expect(texts('.barber__name')).toEqual(['Γιώργος Π.', 'Νίκος Κ.']);
      const photo = query('img.barber__avatar');
      expect(photo.getAttribute('src')).toBe('https://images.test/giorgos.jpg');
      // The name is printed under the avatar, so the avatar is decorative.
      expect(photo.getAttribute('alt')).toBe('');
      expect(query('.barber__avatar--initials').textContent.trim()).toBe('ΝΚ');
    });

    it('leaves the section out when there is no barber', async () => {
      await open(companyDetails({ barbers: [] }));

      expect(element().querySelector('lib-barbershop-barbers')).toBeNull();
    });
  });

  describe('location', () => {
    it('links to Google Maps directions in a new tab', async () => {
      await open();

      const link = query('.shop-map-links__directions') as HTMLAnchorElement;
      expect(link.getAttribute('href')).toBe(
        'https://www.google.com/maps/dir/?api=1&destination=37.9794%2C23.7389',
      );
      expect(link.target).toBe('_blank');
      expect(link.rel).toBe('noopener noreferrer');
    });

    it('links to the shop in Google Maps in a new tab', async () => {
      await open();

      const link = query('.shop-map-links__google-maps') as HTMLAnchorElement;
      expect(link.getAttribute('href')).toBe(
        'https://www.google.com/maps/search/?api=1&query=37.9794%2C23.7389',
      );
      expect(link.target).toBe('_blank');
      expect(link.rel).toBe('noopener noreferrer');
      expect(link.textContent).toContain('Δες το στο Google Maps');
    });

    it('renders the address without waiting for the map', async () => {
      await open();

      expect(query('.location__address').textContent).toContain('Σκουφά 28');
      expect(element().querySelector('lib-barbershops-map-skeleton')).not.toBeNull();
      expect(mapLibreMock.construct).not.toHaveBeenCalled();
    });

    it('opens the map on the shop at street level, with no recenter control', async () => {
      await open();

      const blocks = await harness.fixture.getDeferBlocks();
      for (const block of blocks) await block.render(DeferBlockState.Complete);
      TestBed.inject(ApplicationRef).tick();

      await vi.waitFor(() => {
        expect(mapLibreMock.construct).toHaveBeenCalledOnce();
      });
      expect(mapLibreMock.construct).toHaveBeenCalledWith(
        expect.objectContaining({ center: [23.7389, 37.9794], zoom: 16 }),
      );
      await harness.fixture.whenStable();
      harness.detectChanges();
      expect(element().querySelector('.map-recenter')).toBeNull();
    });
  });

  describe('head', () => {
    it('names the page after the shop and publishes it with the main photo', async () => {
      await open();

      expect(readPageMeta(TestBed.inject(Router).routerState.snapshot.root)).toEqual({
        title: 'Barber House Κολωνάκι',
        description: 'Barber House Κολωνάκι, Κολωνάκι: δες υπηρεσίες.',
        image: 'https://images.test/photo-1.jpg',
        indexable: true,
      });
      expect(response.status).toBe(200);
    });

    it('falls back to the logo when the shop has no photo', async () => {
      await open(companyDetails({ photos: [] }));

      expect(readPageMeta(TestBed.inject(Router).routerState.snapshot.root)?.image).toBe(
        'https://images.test/logo.png',
      );
    });

    it("prefers the shop's own description", async () => {
      await open(companyDetails({ description: 'Κλασικό κουρείο από το 1978.' }));

      expect(readPageMeta(TestBed.inject(Router).routerState.snapshot.root)?.description).toBe(
        'Κλασικό κουρείο από το 1978.',
      );
    });
  });

  describe('an unknown slug', () => {
    it('says the shop was not found and offers the list', async () => {
      await open(404);

      expect(query('h1').textContent.trim()).toBe('Δεν βρήκαμε αυτό το κουρείο');
      expect(query('.shop-message a').getAttribute('href')).toBe('/el/barbershops');
    });

    it('answers 404, uncached and unindexed', async () => {
      await open(404);

      expect(response.status).toBe(404);
      const headers = response.headers as Headers;
      expect(headers.get('Cache-Control')).toBe('no-store');
      expect(headers.get('X-Robots-Tag')).toBe('noindex');
      expect(readPageMeta(TestBed.inject(Router).routerState.snapshot.root)).toMatchObject({
        title: 'Το κουρείο δεν βρέθηκε',
        indexable: false,
      });
    });
  });

  describe('a failed load', () => {
    it('answers 500 and offers a retry that asks again', async () => {
      await open(503);

      expect(response.status).toBe(500);
      expect(query('h1').textContent.trim()).toBe('Δεν μπορέσαμε να φορτώσουμε το κουρείο.');

      query('.shop-message button').click();
      await vi.waitFor(() => {
        http
          .expectOne((request) => request.url.endsWith(`/companies/${SLUG}`))
          .flush(companyDetails());
      });
      await harness.fixture.whenStable();
      harness.detectChanges();

      expect(query('h1').textContent.trim()).toBe('Barber House Κολωνάκι');
    });
  });

  describe('booking page', () => {
    it('loads the shop booking options and nothing else', async () => {
      const navigation = harness.navigateByUrl(`/${SLUG}/booking`);

      // The options are resolved so the stepper has services and barbers to render.
      await vi.waitFor(() => {
        http
          .expectOne((candidate) =>
            candidate.urlWithParams.endsWith(`/companies/${SLUG}/booking-options?languageCode=el`),
          )
          .flush(bookingOptions());
      });
      await navigation;
      await harness.fixture.whenStable();
      harness.detectChanges();

      // Availability is deliberately not resolved: it changes by the minute, and a day list
      // rendered on the server is stale before it paints.
      http.expectNone((candidate) => candidate.url.includes('/availability/'));
    });
  });
});
