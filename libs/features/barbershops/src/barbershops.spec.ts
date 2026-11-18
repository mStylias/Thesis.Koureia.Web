import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ApplicationRef, Injectable, LOCALE_ID, type WritableSignal } from '@angular/core';
import { DeferBlockState, TestBed } from '@angular/core/testing';
import { Location } from '@angular/common';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { By } from '@angular/platform-browser';
import { provideTransloco, Translation, TranslocoLoader } from '@jsverse/transloco';
import { DatePicker } from '@ui/date-picker';
import { Observable, of } from 'rxjs';
import { barbershopsRoutes } from './lib.routes';
import { CARD_ENTER_TOTAL_MS } from './card-choreography';
import type { CompanyCardResponse, BarbershopFilters } from './data/barbershops.api.types';

const mapLibreMock = vi.hoisted(() => ({
  addControl: vi.fn(),
  construct: vi.fn(),
  easeTo: vi.fn(),
  fitBounds: vi.fn(),
  mapClick: vi.fn<(handler: () => void) => void>(),
  markerAdded: vi.fn(),
  markerRemoved: vi.fn(),
  navigationControl: vi.fn(),
  popupAdded: vi.fn<(content: HTMLElement) => void>(),
  popupContent: vi.fn<(content: HTMLElement) => void>(),
  popupRemoved: vi.fn(),
  remove: vi.fn(),
  setWorkerUrl: vi.fn(),
}));

vi.mock('maplibre-gl', () => {
  class Map {
    // MapLibre moves every marker element into this container, and the component relies on it:
    // markers are created detached and handed over. A mock that skipped the move would leave
    // them out of the document and hide anything that depends on where they land.
    readonly container: HTMLElement;

    constructor(options: { container: HTMLElement }) {
      mapLibreMock.construct(options);
      this.container = options.container;
    }

    addControl(control: unknown, position: string): this {
      mapLibreMock.addControl(control, position);
      return this;
    }

    once(event: string, listener: () => void): this {
      if (event === 'load') {
        queueMicrotask(listener);
      }
      return this;
    }

    fitBounds(bounds: unknown, options: unknown): this {
      mapLibreMock.fitBounds(bounds, options);
      return this;
    }

    easeTo(options: unknown): this {
      mapLibreMock.easeTo(options);
      return this;
    }

    remove(): void {
      mapLibreMock.remove();
    }
  }

  function NavigationControl(options: unknown): object {
    mapLibreMock.navigationControl(options);
    return {};
  }

  class Marker {
    constructor(private readonly options: { element: HTMLElement }) {}

    setLngLat(): this {
      return this;
    }

    addTo(map: Map): this {
      map.container.append(this.options.element);
      mapLibreMock.markerAdded(this.options.element);
      return this;
    }

    remove(): this {
      this.options.element.remove();
      mapLibreMock.markerRemoved();
      return this;
    }
  }

  // Models the two behaviours the component depends on: `addTo` on an open popup removes it
  // first, and removing raises `close`.
  class Popup {
    private content: HTMLElement = document.createElement('div');
    private open = false;
    private closeListener?: () => void;

    on(event: string, listener: () => void): this {
      if (event === 'close') this.closeListener = listener;
      return this;
    }

    setLngLat(): this {
      return this;
    }

    getElement(): HTMLElement {
      return this.content;
    }

    setDOMContent(content: HTMLElement): this {
      this.content = content;
      mapLibreMock.popupContent(content);
      return this;
    }

    isOpen(): boolean {
      return this.open;
    }

    addTo(): this {
      if (this.open) this.remove();
      this.open = true;
      mapLibreMock.popupAdded(this.content);
      return this;
    }

    remove(): this {
      if (!this.open) return this;
      this.open = false;
      mapLibreMock.popupRemoved();
      this.closeListener?.();
      return this;
    }
  }

  class LngLatBounds {
    extend(): this {
      return this;
    }
  }

  return {
    LngLatBounds,
    Map,
    Marker,
    NavigationControl,
    Popup,
    setWorkerUrl: mapLibreMock.setWorkerUrl,
    supported: () => true,
  };
});

// jsdom implements neither matchMedia (the CDK BreakpointObserver needs it) nor the <dialog>
// methods (the map panel is a drawer).
beforeAll(() => {
  window.matchMedia = (query: string): MediaQueryList => ({
    matches: false,
    media: query,
    onchange: null,
    // MediaQueryList still declares the legacy listener methods.
    // oxlint-disable-next-line typescript/no-deprecated
    addListener: () => undefined,
    // oxlint-disable-next-line typescript/no-deprecated
    removeListener: () => undefined,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
    dispatchEvent: () => false,
  });

  HTMLDialogElement.prototype.showModal = function (this: HTMLDialogElement) {
    this.open = true;
  };
  HTMLDialogElement.prototype.show = function (this: HTMLDialogElement) {
    this.open = true;
  };
  HTMLDialogElement.prototype.close = function (this: HTMLDialogElement) {
    this.open = false;
    this.dispatchEvent(new Event('close'));
  };
});

@Injectable()
class EmptyTranslocoLoader implements TranslocoLoader {
  getTranslation(): Observable<Translation> {
    return of({});
  }
}

/** The page's own state, reached past `protected` so a test can drive it directly. */
interface PageState {
  mapOpen: WritableSignal<boolean>;
  page: WritableSignal<number>;
  filters: WritableSignal<BarbershopFilters>;
  selectedShopId: WritableSignal<string | null>;
}

/**
 * Puts a Geolocation API in front of the locator.
 *
 * jsdom ships neither `navigator.geolocation` nor a secure context, and the control withholds
 * the locate button without both — so a test that skipped this would find no button and pass
 * for the wrong reason.
 */
function stubGeolocation(getCurrentPosition: Geolocation['getCurrentPosition']): void {
  Object.defineProperty(window, 'isSecureContext', { value: true, configurable: true });
  Object.defineProperty(navigator, 'geolocation', {
    value: { getCurrentPosition, watchPosition: vi.fn(), clearWatch: vi.fn() },
    configurable: true,
  });
}

function grantDeviceLocation(coords: { latitude: number; longitude: number }): void {
  stubGeolocation((onSuccess) => {
    onSuccess({ coords, timestamp: Date.now() } as GeolocationPosition);
  });
}

function refuseDeviceLocation(): void {
  stubGeolocation((_onSuccess, onError) => {
    onError?.({
      code: 1,
      PERMISSION_DENIED: 1,
      POSITION_UNAVAILABLE: 2,
      TIMEOUT: 3,
      message: 'denied',
    });
  });
}

function shops(count: number): CompanyCardResponse[] {
  return Array.from({ length: count }, (_, index) => ({
    id: `shop-${index}`,
    slug: `koureio-${index}`,
    name: `Κουρείο ${index}`,
    description: null,
    street: `Οδός ${index}`,
    city: 'Αθήνα',
    region: null,
    postalCode: '11742',
    countryCode: 'GR',
    logoUrl: `https://images.test/logo-${index}.svg`,
    mainPhotoUrl: `https://images.test/shop-${index}.jpg`,
    latitude: 37.97,
    longitude: 23.72,
    distanceMeters: index * 100,
    timezone: 'Europe/Athens',
    currency: 'EUR',
    slotIntervalMinutes: 15,
    primaryBusinessTypeCode: 'barbershop',
  }));
}

describe('Barbershops route', () => {
  let harness: RouterTestingHarness;
  let http: HttpTestingController;

  beforeEach(async () => {
    vi.clearAllMocks();

    await TestBed.configureTestingModule({
      providers: [
        provideRouter(barbershopsRoutes),
        provideHttpClient(),
        provideHttpClientTesting(),
        provideTransloco({
          config: {
            availableLangs: ['el', 'en'],
            defaultLang: 'el',
            fallbackLang: 'en',
          },
          loader: EmptyTranslocoLoader,
        }),
      ],
    }).compileComponents();

    harness = await RouterTestingHarness.create();
    http = TestBed.inject(HttpTestingController);
  });

  /** The list request the page issues on load. It has to be answered, or nothing ever stabilizes. */
  function answerListRequest(): void {
    http.expectOne((candidate) => candidate.url.endsWith('/companies/all')).flush([]);
  }

  it('renders the Greek title and an empty Athens map', async () => {
    await harness.navigateByUrl('/');
    answerListRequest();

    const element = harness.fixture.nativeElement as HTMLElement;
    expect(element.querySelector('h1')?.textContent).toContain('Κουρεία');
    expect(element.querySelector('lib-barbershops-map-skeleton')).not.toBeNull();

    const [mapDeferBlock] = await harness.fixture.getDeferBlocks();
    await mapDeferBlock.render(DeferBlockState.Complete);
    TestBed.inject(ApplicationRef).tick();
    await harness.fixture.whenStable();

    await vi.waitFor(() => {
      expect(element.querySelector('lib-barbershops-map')).not.toBeNull();
    });

    await vi.waitFor(() => {
      expect(mapLibreMock.construct).toHaveBeenCalledOnce();
    });

    expect(mapLibreMock.construct).toHaveBeenCalledWith(
      expect.objectContaining({
        attributionControl: { compact: true },
        center: [23.7275, 37.9838],
        style: 'https://tiles.openfreemap.org/styles/liberty',
        zoom: 12,
      }),
    );
    // Without this the worker 404s and the map never leaves its skeleton.
    expect(mapLibreMock.setWorkerUrl).toHaveBeenCalledWith('/maplibre/maplibre-gl-worker.mjs');
  });

  it('removes the MapLibre instance when the route is destroyed', async () => {
    await harness.navigateByUrl('/');
    answerListRequest();

    const [mapDeferBlock] = await harness.fixture.getDeferBlocks();
    await mapDeferBlock.render(DeferBlockState.Complete);
    TestBed.inject(ApplicationRef).tick();

    await vi.waitFor(() => {
      expect(mapLibreMock.construct).toHaveBeenCalledOnce();
    });

    harness.fixture.destroy();

    expect(mapLibreMock.remove).toHaveBeenCalledOnce();
  });
});

describe('Barbershops list', () => {
  let harness: RouterTestingHarness;
  let http: HttpTestingController;

  beforeEach(async () => {
    vi.clearAllMocks();

    await TestBed.configureTestingModule({
      providers: [
        provideRouter(barbershopsRoutes),
        provideHttpClient(),
        provideHttpClientTesting(),
        provideTransloco({
          config: { availableLangs: ['el', 'en'], defaultLang: 'el', fallbackLang: 'en' },
          loader: EmptyTranslocoLoader,
        }),
      ],
    }).compileComponents();

    harness = await RouterTestingHarness.create();
    http = TestBed.inject(HttpTestingController);
  });

  /** Loads the route and answers its one request with `body`. */
  async function load(body: CompanyCardResponse[] | null): Promise<HTMLElement> {
    await harness.navigateByUrl('/');
    // No filter is set, so the page reads the cached whole list.
    const request = http.expectOne((candidate) => candidate.url.endsWith('/companies/all'));

    if (body === null) {
      request.flush(null, { status: 500, statusText: 'Internal Server Error' });
    } else {
      request.flush(body);
    }

    await harness.fixture.whenStable();
    harness.detectChanges();
    return harness.fixture.nativeElement as HTMLElement;
  }

  function state(): PageState {
    return harness.routeDebugElement?.componentInstance as PageState;
  }

  it('shows one page of 20 out of 25 results', async () => {
    const element = await load(shops(25));

    expect(element.querySelectorAll('lib-barbershop-card')).toHaveLength(20);
    expect(element.querySelector('lib-paginator')).not.toBeNull();
  });

  it('shows the remaining 5 on the second page', async () => {
    const element = await load(shops(25));

    state().page.set(2);
    harness.detectChanges();

    const cards = element.querySelectorAll('lib-barbershop-card');
    expect(cards).toHaveLength(5);
    expect(cards[0].textContent).toContain('Κουρείο 20');
  });

  it('hides the paginator when everything fits on one page', async () => {
    const element = await load(shops(20));

    expect(element.querySelector('lib-paginator')?.children).toHaveLength(0);
  });

  it("links every card to the shop's home page by its slug", async () => {
    const element = await load(shops(1));

    const link = element.querySelector<HTMLAnchorElement>('lib-barbershop-card a');
    // The language prefix comes from `langLink`. The page exists, so the link is followed.
    expect(link?.getAttribute('href')).toBe('/el/barbershops/koureio-0');
    expect(link?.rel).toBe('');
  });

  it("links every card's photo to the shop's home page, outside the tab order", async () => {
    const element = await load(shops(1));

    const link = element.querySelector<HTMLAnchorElement>('lib-barbershop-card [libcardmedia] a');
    expect(link?.getAttribute('href')).toBe('/el/barbershops/koureio-0');
    expect(link?.querySelector('img')).not.toBeNull();
    // The title is the same link and keeps the tab stop.
    expect(link?.tabIndex).toBe(-1);
  });

  it("links every card's booking button to the shop's booking page", async () => {
    const element = await load(shops(1));

    const button = element.querySelector<HTMLAnchorElement>('lib-barbershop-card a[libButton]');
    expect(button?.getAttribute('href')).toBe('/el/barbershops/koureio-0/booking');
  });

  it('gives each card the shop photo across its media band', async () => {
    const element = await load(shops(1));

    const photo = element.querySelector<HTMLImageElement>('lib-barbershop-card [libcardmedia] img');
    expect(photo?.getAttribute('src')).toBe('https://images.test/shop-0.jpg');
    // Named, not decorative: it is a photograph of the place, not a mark beside its own name.
    expect(photo?.getAttribute('alt')).toContain('Κουρείο 0');
  });

  it('draws a placeholder, not the logo, when a shop has no photo', async () => {
    const element = await load([{ ...shops(1)[0], mainPhotoUrl: null }]);

    expect(element.querySelector('lib-barbershop-card [libcardmedia] img')).toBeNull();
    expect(element.querySelector('lib-barbershop-card [libcardmedia] svg')).not.toBeNull();
  });

  it('staggers the first cards in, then lets the rest arrive together', async () => {
    const element = await load(shops(25));

    const delays = [...element.querySelectorAll<HTMLElement>('.shop-list__grid > li')].map((li) =>
      li.style.getPropertyValue('--shop-card-enter-delay'),
    );

    expect(delays.slice(0, 3)).toEqual(['0ms', '20ms', '40ms']);
    // The delay plus `--dur-base` is the whole sequence, and it has to stay inside 300ms.
    expect(delays[7]).toBe('60ms');
    expect(delays[19]).toBe('60ms');
  });

  it('says the list is empty rather than showing nothing', async () => {
    const element = await load([]);

    expect(element.querySelectorAll('lib-barbershop-card')).toHaveLength(0);
    expect(element.textContent).toContain('Δεν υπάρχουν ακόμη κουρεία εδώ.');
  });

  it('reports a failed load and retries it', async () => {
    const element = await load(null);

    expect(element.querySelector('[role="alert"]')?.textContent).toContain(
      'Δεν μπορέσαμε να φορτώσουμε τα κουρεία.',
    );

    element.querySelector<HTMLButtonElement>('[role="alert"] button')?.click();
    harness.detectChanges();

    http.expectOne((candidate) => candidate.url.endsWith('/companies/all')).flush(shops(1));
    await harness.fixture.whenStable();
    harness.detectChanges();

    expect(element.querySelectorAll('lib-barbershop-card')).toHaveLength(1);
  });

  it('returns to the first page when the filters change', async () => {
    await load(shops(25));

    state().page.set(2);
    harness.detectChanges();

    state().filters.set({ name: 'Ακρόπολη', date: null, origin: null });

    // The filter is debounced, so the new query — and the reset — land a moment later.
    await vi.waitFor(() => {
      const request = http.expectOne((candidate) => candidate.url.endsWith('/companies'));
      request.flush(shops(3));
    });

    await harness.fixture.whenStable();
    harness.detectChanges();

    expect(state().page()).toBe(1);
  });

  it('keeps the cards on screen while a narrower filter loads', async () => {
    const element = await load(shops(25));

    state().filters.set({ name: 'Ακρόπολη', date: null, origin: null });
    await vi.waitFor(() => {
      http.expectOne((candidate) => candidate.url.endsWith('/companies'));
    });
    harness.detectChanges();

    // Swapping a full grid for skeletons and back is two layout jolts for an answer that has
    // not arrived yet. The grid says it is out of date instead.
    expect(element.querySelectorAll('lib-barbershop-card')).toHaveLength(20);
    expect(element.querySelector('.shop-list__grid')?.getAttribute('aria-busy')).toBe('true');
    expect(element.querySelector('lib-barbershop-card-skeleton')).toBeNull();
  });
});

describe('Barbershops map and filters', () => {
  let harness: RouterTestingHarness;
  let http: HttpTestingController;

  beforeEach(async () => {
    vi.clearAllMocks();

    await TestBed.configureTestingModule({
      providers: [
        provideRouter(barbershopsRoutes),
        provideHttpClient(),
        provideHttpClientTesting(),
        // What `provideAppLanguage` sets from the language in the path.
        { provide: LOCALE_ID, useValue: 'el' },
        provideTransloco({
          config: { availableLangs: ['el', 'en'], defaultLang: 'el', fallbackLang: 'en' },
          loader: EmptyTranslocoLoader,
        }),
      ],
    }).compileComponents();

    harness = await RouterTestingHarness.create();
    http = TestBed.inject(HttpTestingController);
  });

  /** Loads the route, answers the list request, and forces the map's defer block to render. */
  async function loadWithMap(body: CompanyCardResponse[]): Promise<HTMLElement> {
    await harness.navigateByUrl('/');
    http.expectOne((candidate) => candidate.url.endsWith('/companies/all')).flush(body);

    const [mapDeferBlock] = await harness.fixture.getDeferBlocks();
    await mapDeferBlock.render(DeferBlockState.Complete);
    TestBed.inject(ApplicationRef).tick();
    await harness.fixture.whenStable();
    harness.detectChanges();

    return harness.fixture.nativeElement as HTMLElement;
  }

  it('pins every loaded shop, not only the page on screen', async () => {
    await loadWithMap(shops(25));

    // 20 cards are showing. All 25 shops are on the map, which is the point of paging in front.
    await vi.waitFor(() => {
      expect(mapLibreMock.markerAdded).toHaveBeenCalledTimes(25);
    });
    expect(
      (harness.fixture.nativeElement as HTMLElement).querySelectorAll('lib-barbershop-card'),
    ).toHaveLength(20);
  });

  it('frames the pins on load, and again on whatever a filter leaves behind', async () => {
    await loadWithMap(shops(3));
    await vi.waitFor(() => {
      expect(mapLibreMock.fitBounds).toHaveBeenCalledOnce();
    });

    state().filters.set({ name: 'Κουρείο 0', date: null, origin: null });
    await vi.waitFor(() => {
      http.expectOne((candidate) => candidate.url.endsWith('/companies')).flush(shops(1));
    });
    await harness.fixture.whenStable();
    harness.detectChanges();

    await vi.waitFor(() => {
      expect(mapLibreMock.fitBounds).toHaveBeenCalledTimes(2);
    });
  });

  it('leaves the view alone when the results have not changed', async () => {
    await loadWithMap(shops(3));
    await vi.waitFor(() => {
      expect(mapLibreMock.fitBounds).toHaveBeenCalledOnce();
    });

    // The marker effect re-runs for reasons other than the results changing — selecting a pin
    // is one. Refitting then would undo a pan the reader had just made.
    (harness.fixture.nativeElement as HTMLElement)
      .querySelector<HTMLButtonElement>('lib-barbershop-marker button')
      ?.click();
    harness.detectChanges();
    await harness.fixture.whenStable();

    expect(mapLibreMock.fitBounds).toHaveBeenCalledOnce();
  });

  it('opens a popup naming the shop when its pin is clicked', async () => {
    const element = await loadWithMap(shops(1));

    await vi.waitFor(() => {
      expect(mapLibreMock.markerAdded).toHaveBeenCalledOnce();
    });
    harness.detectChanges();

    element.querySelector<HTMLButtonElement>('lib-barbershop-marker button')?.click();
    harness.detectChanges();

    await vi.waitFor(() => {
      expect(mapLibreMock.popupAdded).toHaveBeenCalledOnce();
    });

    const content = mapLibreMock.popupAdded.mock.calls[0][0];
    expect(content.textContent).toContain('Κουρείο 0');
    // The map is already looking at that shop, so the popup's own card offers no locator.
    expect(content.querySelector('.shop-card__locate')).toBeNull();
    // The popup carries the same navigation the card in the list does.
    expect(content.querySelector('a')?.getAttribute('href')).toBe('/el/barbershops/koureio-0');
  });

  it('switches the popup to the pin that was clicked, rather than just closing', async () => {
    const element = await loadWithMap(shops(2));
    await vi.waitFor(() => {
      expect(mapLibreMock.markerAdded).toHaveBeenCalledTimes(2);
    });
    harness.detectChanges();

    const pins = element.querySelectorAll<HTMLButtonElement>('lib-barbershop-marker button');
    pins[0].click();
    harness.detectChanges();
    await vi.waitFor(() => {
      expect(mapLibreMock.popupAdded).toHaveBeenCalledOnce();
    });

    pins[1].click();
    harness.detectChanges();

    // The open popup is moved, never re-added: `addTo` on an open popup removes it first, and
    // removing raises `close`, which cleared the selection mid-flight and left nothing open.
    await vi.waitFor(() => {
      expect(mapLibreMock.popupContent).toHaveBeenCalledTimes(2);
    });
    expect(mapLibreMock.popupContent.mock.calls[1][0].textContent).toContain('Κουρείο 1');
    expect(mapLibreMock.popupRemoved).not.toHaveBeenCalled();
    expect(state().selectedShopId()).toBe('shop-1');
  });

  it('centres the pin before opening, so the popup has room to land', async () => {
    const element = await loadWithMap(shops(1));
    await vi.waitFor(() => {
      expect(mapLibreMock.markerAdded).toHaveBeenCalledOnce();
    });
    harness.detectChanges();

    element.querySelector<HTMLButtonElement>('lib-barbershop-marker button')?.click();
    harness.detectChanges();

    // MapLibre picks the popup's anchor from where the pin sits and never pans to fit it.
    await vi.waitFor(() => {
      expect(mapLibreMock.easeTo).toHaveBeenCalledWith({ center: [23.72, 37.97], offset: [0, 0] });
    });
  });

  it('raises the pin when its popup is taller than half the map', async () => {
    // jsdom does no layout. Give the map 800px, the popup 600px and the pin 40px.
    onTestFinished(() => {
      vi.restoreAllMocks();
    });
    vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockImplementation(function (
      this: HTMLElement,
    ) {
      return this.classList.contains('map-container') ? 800 : 0;
    });
    vi.spyOn(HTMLElement.prototype, 'offsetHeight', 'get').mockImplementation(function (
      this: HTMLElement,
    ) {
      if (this.classList.contains('shop-popup')) return 600;
      return this.localName === 'lib-barbershop-marker' ? 40 : 0;
    });

    const element = await loadWithMap(shops(1));
    await vi.waitFor(() => {
      expect(mapLibreMock.markerAdded).toHaveBeenCalledOnce();
    });
    harness.detectChanges();

    element.querySelector<HTMLButtonElement>('lib-barbershop-marker button')?.click();
    harness.detectChanges();

    // Pin, gap and popup make a 636px block. Centred in 800px, the pin sits at 102px, which is
    // 298px above the middle. MapLibre then opens the popup below the pin, inside the map.
    await vi.waitFor(() => {
      expect(mapLibreMock.easeTo).toHaveBeenCalledWith({
        center: [23.72, 37.97],
        offset: [0, -298],
      });
    });
  });

  it('keeps a pin click off the map, so it cannot close the popup it opens', async () => {
    const element = await loadWithMap(shops(1));
    await vi.waitFor(() => {
      expect(mapLibreMock.markerAdded).toHaveBeenCalledOnce();
    });
    harness.detectChanges();

    // A marker element is a child of the map container, so a bubbling click raises a map click
    // and MapLibre's `closeOnClick` would shut the popup this very click is opening.
    const onMapClick = vi.fn();
    element.querySelector('.map-container')?.addEventListener('click', onMapClick);

    element.querySelector<HTMLButtonElement>('lib-barbershop-marker button')?.click();

    expect(onMapClick).not.toHaveBeenCalled();
    expect(state().selectedShopId()).toBe('shop-0');
  });

  it('drops the pins of shops a filter removed', async () => {
    await loadWithMap(shops(3));
    await vi.waitFor(() => {
      expect(mapLibreMock.markerAdded).toHaveBeenCalledTimes(3);
    });

    state().filters.set({ name: 'Κουρείο 0', date: null, origin: null });

    await vi.waitFor(() => {
      http.expectOne((candidate) => candidate.url.endsWith('/companies')).flush(shops(1));
    });
    await harness.fixture.whenStable();
    harness.detectChanges();

    // Two gone, one kept — never a rebuild of all three.
    await vi.waitFor(() => {
      expect(mapLibreMock.markerRemoved).toHaveBeenCalledTimes(2);
    });
    expect(mapLibreMock.markerAdded).toHaveBeenCalledTimes(3);
  });

  it('searches by name from the filter bar', async () => {
    const element = await loadWithMap(shops(3));

    const input = element.querySelector<HTMLInputElement>('#barbershop-name');
    if (input === null) throw new Error('the name filter is missing');
    input.value = 'Ακρόπολη';
    input.dispatchEvent(new Event('input'));
    harness.detectChanges();

    await vi.waitFor(() => {
      const request = http.expectOne((candidate) => candidate.url.endsWith('/companies'));
      expect(request.request.params.get('search')).toBe('Ακρόπολη');
      request.flush([]);
    });
  });

  it('reads the date in the locale the page is published in', async () => {
    await loadWithMap(shops(1));

    // Left unstated, the picker takes the browser's first language once hydration has run,
    // which reads a Greek page as mm/dd/yyyy and changes the field's shape mid-load.
    const picker = harness.fixture.debugElement.query(By.css('lib-date-picker'));
    expect((picker.componentInstance as DatePicker).locale()).toBe('el');
  });

  /** Types into the location field. The 340 ms settle is left for the caller to wait out. */
  async function searchLocation(element: HTMLElement, text: string): Promise<void> {
    const field = element.querySelector<HTMLInputElement>('#barbershop-location');
    if (!field) {
      throw new Error('location field not rendered');
    }
    field.focus();
    field.value = text;
    field.dispatchEvent(new InputEvent('input', { bubbles: true, data: text }));
    harness.detectChanges();
    await harness.fixture.whenStable();
  }

  /**
   * The locate button, once it exists.
   *
   * It is withheld until its name resolves, and the feature's Transloco scope is a dynamic
   * import — so it appears a tick after the rest of the field.
   */
  async function locateButton(element: HTMLElement): Promise<HTMLButtonElement> {
    let button: HTMLButtonElement | null = null;
    await vi.waitFor(() => {
      harness.detectChanges();
      button = element.querySelector<HTMLButtonElement>('.autocomplete-action');
      expect(button).not.toBeNull();
    });
    return button as unknown as HTMLButtonElement;
  }

  function placeRequest() {
    return http.expectOne((candidate) => candidate.url.endsWith('/places'));
  }

  function suggestions(): HTMLElement[] {
    return Array.from(document.querySelectorAll<HTMLElement>('.autocomplete-option'));
  }

  function panelText(): string {
    return document.querySelector('.autocomplete-panel')?.textContent.trim() ?? '';
  }

  const KOLONAKI = {
    id: 'opaque-1',
    label: 'Κολωνάκι',
    context: 'Αθήνα, Αττική',
    type: 'city',
    latitude: 37.9795,
    longitude: 23.7442,
    countryCode: 'GR',
    city: 'Αθήνα',
    region: 'Αττική',
    street: null,
    postalCode: '10673',
  };

  it('does not search for a place until two characters are typed', async () => {
    const element = await loadWithMap(shops(1));

    await searchLocation(element, 'Κ');

    await vi.waitFor(() => {
      harness.detectChanges();
      expect(panelText()).toContain('Γράψε τουλάχιστον δύο γράμματα');
    });
    http.expectNone((candidate) => candidate.url.endsWith('/places'));
  });

  it('orders the list from the place that was chosen, and pins it', async () => {
    const element = await loadWithMap(shops(2));

    await searchLocation(element, 'Κολ');
    await vi.waitFor(() => {
      placeRequest().flush([KOLONAKI]);
    });
    harness.detectChanges();
    await harness.fixture.whenStable();

    expect(suggestions()[0].textContent).toContain('Κολωνάκι');
    suggestions()[0].click();
    harness.detectChanges();

    // The cached whole-list answer is measured from the configured default, so a chosen origin
    // has to leave it for the filtered endpoint.
    await vi.waitFor(
      () => {
        const request = http.expectOne((candidate) => candidate.url.endsWith('/companies'));
        expect(request.request.params.get('latitude')).toBe('37.9795');
        expect(request.request.params.get('longitude')).toBe('23.7442');
        request.flush(shops(2));
      },
      { timeout: 2000 },
    );
    harness.detectChanges();
    await harness.fixture.whenStable();

    expect(element.querySelector('lib-origin-marker')?.textContent).toContain('Κολωνάκι');
    expect(element.textContent).toContain('απόσταση από Κολωνάκι');
    expect(mapLibreMock.easeTo).toHaveBeenCalledWith({ center: [23.7442, 37.9795] });
  });

  it('keeps the suggestions on screen when the search is throttled', async () => {
    const element = await loadWithMap(shops(1));

    await searchLocation(element, 'Κολ');
    await vi.waitFor(() => {
      placeRequest().flush([KOLONAKI]);
    });
    harness.detectChanges();
    await harness.fixture.whenStable();
    expect(suggestions()).toHaveLength(1);

    await searchLocation(element, 'Κολω');
    await vi.waitFor(() => {
      placeRequest().flush(
        { title: 'PLACE_SEARCH_RATE_LIMITED', status: 429 },
        { status: 429, statusText: 'Too Many Requests' },
      );
    });
    harness.detectChanges();
    await harness.fixture.whenStable();

    // Typing too fast is not a fault and must never read as one.
    expect(suggestions()).toHaveLength(1);
    expect(panelText()).not.toContain('Δεν μπορέσαμε');
  });

  it('says location search is unavailable rather than that it broke', async () => {
    const element = await loadWithMap(shops(1));

    await searchLocation(element, 'Κολ');
    await vi.waitFor(() => {
      placeRequest().flush(null, { status: 503, statusText: 'Service Unavailable' });
    });
    harness.detectChanges();
    await harness.fixture.whenStable();

    expect(panelText()).toContain('δεν είναι διαθέσιμη');
  });

  it('orders the list from the device, and names that on the map', async () => {
    grantDeviceLocation({ latitude: 40.6401, longitude: 22.9444 });
    const element = await loadWithMap(shops(2));

    (await locateButton(element)).click();
    await vi.waitFor(
      () => {
        const request = http.expectOne((candidate) => candidate.url.endsWith('/companies'));
        expect(request.request.params.get('latitude')).toBe('40.6401');
        request.flush(shops(2));
      },
      { timeout: 2000 },
    );
    harness.detectChanges();
    await harness.fixture.whenStable();

    // No name is invented for a device fix, so the pin and the caption say so generically.
    expect(element.querySelector('lib-origin-marker')?.textContent).toContain('Η τοποθεσία σου');
    expect(element.textContent).toContain('εκεί που βρίσκεσαι');
  });

  it('explains a refused permission and stops asking', async () => {
    refuseDeviceLocation();
    const element = await loadWithMap(shops(1));

    (await locateButton(element)).click();
    await vi.waitFor(() => {
      harness.detectChanges();
      expect(element.querySelector('.filters__locate-error')?.textContent).toContain('Δώσε άδεια');
    });

    // The browser answers a refusal without prompting again, so the control must stop trying.
    expect(element.querySelector<HTMLButtonElement>('.autocomplete-action')?.disabled).toBe(true);
  });

  it('returns to the default origin from the caption', async () => {
    grantDeviceLocation({ latitude: 40.6401, longitude: 22.9444 });
    const element = await loadWithMap(shops(1));

    (await locateButton(element)).click();
    await vi.waitFor(
      () => {
        http.expectOne((candidate) => candidate.url.endsWith('/companies')).flush(shops(1));
      },
      { timeout: 2000 },
    );
    harness.detectChanges();
    await harness.fixture.whenStable();
    expect(element.querySelector('lib-origin-marker')).not.toBeNull();

    element.querySelector<HTMLButtonElement>('.filters__clear-origin')?.click();
    await vi.waitFor(
      () => {
        http.expectOne((candidate) => candidate.url.endsWith('/companies/all')).flush(shops(1));
      },
      { timeout: 2000 },
    );
    harness.detectChanges();
    await harness.fixture.whenStable();

    expect(element.querySelector('lib-origin-marker')).toBeNull();
    expect(element.textContent).toContain('κέντρο της Αθήνας');
  });

  it('closes the map panel on the back gesture, rather than leaving the page', async () => {
    const element = await loadWithMap(shops(1));
    await openMapPanel(element);
    expect(element.querySelector('lib-drawer lib-barbershops-map')).not.toBeNull();

    // The panel added a history entry of its own when it opened; this is that entry going back.
    window.dispatchEvent(new PopStateEvent('popstate', { state: null }));
    harness.detectChanges();
    await harness.fixture.whenStable();
    harness.detectChanges();

    expect(state().mapOpen()).toBe(false);
    expect(element.querySelector('lib-drawer lib-barbershops-map')).toBeNull();
  });

  it('spends the panel’s history entry when it is closed by hand', async () => {
    const back = vi.spyOn(TestBed.inject(Location), 'back');
    const element = await loadWithMap(shops(1));
    await openMapPanel(element);

    state().mapOpen.set(false);
    harness.detectChanges();
    await harness.fixture.whenStable();

    // Left on the stack, the next back gesture would land on a panel that is already shut.
    expect(back).toHaveBeenCalledOnce();
  });

  it('opens the map panel from the always-visible button', async () => {
    const element = await loadWithMap(shops(1));

    // Below the map breakpoint the layout has no map column, so this is the only way in — and
    // it sits in a bar of its own rather than floating over the list.
    expect(element.querySelector('.barbershops-actionbar .barbershops-map-button')).not.toBeNull();
    expect(element.querySelector('lib-drawer lib-barbershops-map')).toBeNull();

    element.querySelector<HTMLButtonElement>('.barbershops-map-button')?.click();
    harness.detectChanges();
    await harness.fixture.whenStable();
    harness.detectChanges();

    expect(element.querySelector('lib-drawer lib-barbershops-map')).not.toBeNull();
  });

  it('waits for the cards to arrive before it moves the camera', async () => {
    await loadWithMap(shops(3));

    await vi.waitFor(() => {
      expect(mapLibreMock.markerAdded).toHaveBeenCalledTimes(3);
    });

    // The pins are on the map; the frame is not yet set. One filter change starts both the
    // card entrance and this camera move, and two unrelated motions must not share the screen.
    const pinned = performance.now();
    expect(mapLibreMock.fitBounds).not.toHaveBeenCalled();

    await vi.waitFor(() => {
      expect(mapLibreMock.fitBounds).toHaveBeenCalledOnce();
    });

    // Halved, because a loaded machine can only ever make the wait longer.
    expect(performance.now() - pinned).toBeGreaterThanOrEqual(CARD_ENTER_TOTAL_MS / 2);
  });

  it('brings every pin back into view from the map control', async () => {
    const element = await loadWithMap(shops(3));
    await vi.waitFor(() => {
      expect(mapLibreMock.fitBounds).toHaveBeenCalledOnce();
    });

    const control = element.querySelector<HTMLButtonElement>('.map-recenter');
    expect(control).not.toBeNull();
    control?.click();

    // A gesture refits without waiting on the cards, which settled long ago.
    await vi.waitFor(() => {
      expect(mapLibreMock.fitBounds).toHaveBeenCalledTimes(2);
    });
  });

  it('names the locate control, and describes it with a tooltip on hover', async () => {
    const element = await loadWithMap(shops(2));

    const locate = element.querySelector<HTMLButtonElement>('.shop-card__locate');
    if (!locate) throw new Error('the locate control is missing');

    // The icon carries no text, and a tooltip is never an accessible name.
    expect(locate.getAttribute('aria-label')).toBe('Εντόπισε το Κουρείο 0 στον χάρτη');

    locate.dispatchEvent(new MouseEvent('mouseenter'));
    // The tooltip waits out its show delay before it appears.
    await new Promise((resolve) => setTimeout(resolve, 150));
    harness.detectChanges();
    await harness.fixture.whenStable();

    const tooltip = document.querySelector('[role="tooltip"]');
    if (!tooltip) throw new Error('the tooltip is missing');
    expect(tooltip.textContent.trim()).toBe('Εντόπισε το κουρείο');
    expect(locate.getAttribute('aria-describedby')).toBe(tooltip.id);
  });

  it('points a shop out on the map from its card', async () => {
    const element = await loadWithMap(shops(2));

    element.querySelector<HTMLButtonElement>('.shop-card__locate')?.click();
    harness.detectChanges();
    await harness.fixture.whenStable();
    harness.detectChanges();

    expect(state().selectedShopId()).toBe('shop-0');
    // A selection means nothing until a map is on screen to carry it, and below the map
    // breakpoint the panel is the only map there is.
    expect(element.querySelector('lib-drawer lib-barbershops-map')).not.toBeNull();
  });

  /** Opens the small-screen panel the way a reader does. */
  async function openMapPanel(element: HTMLElement): Promise<void> {
    element.querySelector<HTMLButtonElement>('.barbershops-map-button')?.click();
    harness.detectChanges();
    await harness.fixture.whenStable();
    harness.detectChanges();
  }

  function state(): PageState {
    return harness.routeDebugElement?.componentInstance as PageState;
  }
});
