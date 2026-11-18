/**
 * The store against one HTTP boundary: what it asks for, when, and what it writes back.
 */
import {
  EnvironmentInjector,
  Injectable,
  createEnvironmentInjector,
  signal,
  type WritableSignal,
} from '@angular/core';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import {
  provideTransloco,
  type Translation,
  type TranslocoLoader,
  TranslocoService,
} from '@jsverse/transloco';
import { StaffAccessStore } from '@auth/data-access';
import { provideSynaxApi } from '@synax/client';
import { firstValueFrom, of, type Observable } from 'rxjs';
import { appointmentsInlineLoader } from '@features/management-shared-appointments';

import { calendarInlineLoader } from './calendar.i18n';
import { CalendarStore } from './calendar.store';
import type { CalendarViewState } from './calendar.types';

const COMPANY = 'aaaa0000-0000-4000-8000-00000000cafe';
const NIKOS = '0192a0c1-7d44-7a1b-9e2f-3c1d2b4a5e6f';
const BASE = 'http://api.test/api/v1';
const RESOURCES = `${BASE}/users/me/resources`;
const BOOK = `${BASE}/appointments`;

const OPTIONS = {
  timezone: 'Europe/Athens',
  slotIntervalMinutes: 15,
  businessHours: [],
  staffMembers: [],
  serviceCategories: [],
};

const PANEL_KEY = 'management.calendar-panel';
const SETTINGS_KEY = 'management.calendar-settings';

const WEEK_SETTINGS = {
  version: 1,
  view: 'week',
  timeScale: 30,
  dayColumns: 'single',
  showTime: false,
};

/** A saved view of one barber's week. */
const BARBER_VIEW: CalendarViewState = {
  version: 1,
  filters: { barberIds: [NIKOS], customerIds: [], statuses: [], categoryIds: [] },
  view: 'week',
  timeScale: 30,
  dayColumns: 'single',
  showTime: false,
};

@Injectable()
class EmptyLoader implements TranslocoLoader {
  getTranslation(): Observable<Translation> {
    return of({});
  }
}

/** One appointment row, as the calendar's `$select` returns it. */
const ROW = {
  id: 'a1',
  staffMemberId: NIKOS,
  customerId: 'c1',
  customerDisplayName: 'Γιώργος',
  localDate: '2026-09-22',
  localStartTime: '10:00',
  localEndTime: '10:30',
  status: 'pending',
  services: [],
};

describe('CalendarStore', () => {
  let store: CalendarStore;
  let http: HttpTestingController;
  let company: WritableSignal<{ id: string; name: string } | null>;

  beforeEach(async () => {
    localStorage.clear();
    company = signal<{ id: string; name: string } | null>({ id: COMPANY, name: 'Δοκιμή' });
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideSynaxApi({ baseUrl: 'http://api.test', defaultVersion: 1 }),
        provideTransloco({
          config: { availableLangs: ['el', 'en'], defaultLang: 'el', fallbackLang: 'en' },
          loader: EmptyLoader,
        }),
        {
          provide: StaffAccessStore,
          useValue: {
            company,
          },
        },
        CalendarStore,
      ],
    });
    const transloco = TestBed.inject(TranslocoService);
    await firstValueFrom(
      transloco.load('managementCalendar/el', { inlineLoader: calendarInlineLoader }),
    );
    // The status badges read the shared appointments dictionary.
    await firstValueFrom(
      transloco.load('managementAppointments/el', { inlineLoader: appointmentsInlineLoader }),
    );
    store = TestBed.inject(CalendarStore);
    http = TestBed.inject(HttpTestingController);
    await settle();
    http.expectOne((request) => request.url.startsWith(`${BOOK}/calendar-options`)).flush(OPTIONS);
  });

  afterEach(() => {
    http.verify();
  });

  async function settle(ms = 0): Promise<void> {
    TestBed.tick();
    await new Promise((resolve) => setTimeout(resolve, ms));
    TestBed.tick();
  }

  /** Starts the store with the given stored settings, address and default saved view. */
  async function hydrate(
    stored: unknown,
    options: {
      address?: Parameters<CalendarStore['hydrate']>[0];
      narrow?: boolean;
      defaultView?: CalendarViewState | null;
    } = {},
  ): Promise<void> {
    const done = store.hydrate(
      options.address ?? {},
      options.narrow ?? false,
      Promise.resolve(options.defaultView ?? null),
    );
    http
      .expectOne((request) => request.url.startsWith(`${RESOURCES}/odata`))
      .flush({
        value:
          stored === null ? [] : [{ id: 'settings-1', name: 'calendar_settings', value: stored }],
      });
    await done;
    await settle();
  }

  // The calendar draws before the settings land, and its book must not wait for them.
  it('reads the book while the settings are still on their way', async () => {
    const done = store.hydrate({}, false, Promise.resolve(null));
    store.setRange({ start: '2026-09-21', end: '2026-09-28', view: 'week' });
    await settle();

    const settings = http.expectOne((request) => request.url.startsWith(`${RESOURCES}/odata`));
    http.expectOne((request) => request.url.startsWith(`${BOOK}/odata`)).flush({ value: [] });
    settings.flush({ value: [] });
    await done;
  });

  it('moves to the address before the settings land', () => {
    void store.hydrate({ view: 'month', anchor: '2026-09-21' }, false, Promise.resolve(null));

    expect(store.view()).toBe('month');
    expect(store.anchor()).toBe('2026-09-21');
    http.expectOne((request) => request.url.startsWith(`${RESOURCES}/odata`)).flush({ value: [] });
  });

  it('keeps a change made before the settings landed, and writes it', async () => {
    const done = store.hydrate({}, false, Promise.resolve(BARBER_VIEW));
    store.view.set('month');
    http
      .expectOne((request) => request.url.startsWith(`${RESOURCES}/odata`))
      .flush({ value: [{ id: 'settings-1', name: 'calendar_settings', value: WEEK_SETTINGS }] });
    await done;
    await settle(450);

    expect(store.view()).toBe('month');
    expect(store.filters().barberIds).toEqual([]);
    const write = http.expectOne(`${RESOURCES}/settings-1`);
    expect(write.request.body).toEqual({ value: { ...WEEK_SETTINGS, view: 'month' } });
    write.flush({});
  });

  it('lets the address win over the stored view', async () => {
    await hydrate(
      {
        version: 1,
        view: 'month',
        timeScale: 10,
        dayColumns: 'single',
        showTime: false,
      },
      { address: { view: 'day', anchor: '2026-09-21', dayColumns: 'perResource' } },
    );

    expect(store.view()).toBe('day');
    expect(store.anchor()).toBe('2026-09-21');
    expect(store.dayColumns()).toBe('perResource');
    expect(store.timeScale()).toBe(10);
  });

  it('starts a narrow first visit in day view', async () => {
    await hydrate(null, { narrow: true });

    expect(store.view()).toBe('day');
  });

  it('lets the default saved view win over the stored settings, and the address over both', async () => {
    await hydrate(
      {
        version: 1,
        view: 'month',
        timeScale: 30,
        dayColumns: 'single',
        showTime: false,
      },
      {
        address: { anchor: '2026-09-21' },
        defaultView: { ...BARBER_VIEW, view: 'day', timeScale: 10, showTime: true },
      },
    );

    expect(store.view()).toBe('day');
    expect(store.timeScale()).toBe(10);
    expect(store.showTime()).toBe(true);
    expect(store.anchor()).toBe('2026-09-21');
    expect(store.filters().barberIds).toEqual([NIKOS]);
    http.expectNone((request) => request.method === 'PATCH');
  });

  it('applies a saved view without moving the date', async () => {
    await hydrate(null, { address: { view: 'week', anchor: '2026-09-21' } });
    store.applyViewState({ ...BARBER_VIEW, view: 'month' });

    expect(store.view()).toBe('month');
    expect(store.anchor()).toBe('2026-09-21');
    expect(store.viewState()).toEqual({ ...BARBER_VIEW, view: 'month' });
  });

  it('applies the default saved view before the first query', async () => {
    await hydrate(null, { defaultView: BARBER_VIEW });
    store.setRange({ start: '2026-09-21', end: '2026-09-28', view: 'week' });
    await settle();

    const request = http.expectOne((candidate) => candidate.url.startsWith(`${BOOK}/odata`));
    expect(decodeURIComponent(request.request.url)).toContain(
      `$filter=localDate ge 2026-09-21 and localDate lt 2026-09-28 and staffMemberId in (${NIKOS})`,
    );
    request.flush({ value: [] });
  });

  // The row also carries prices and contact details, which the calendar never shows.
  it('selects only the members the tiles read', async () => {
    await hydrate(null);
    store.setRange({ start: '2026-09-21', end: '2026-09-28', view: 'week' });
    await settle();

    const request = http.expectOne((candidate) => candidate.url.startsWith(`${BOOK}/odata`));
    expect(decodeURIComponent(request.request.url)).toContain(
      '$select=id,staffMemberId,customerId,customerDisplayName,localDate,localStartTime,' +
        'localEndTime,status,services',
    );
    request.flush({ value: [] });
  });

  it('refetches everything and drops the rows when the shop changes', async () => {
    await hydrate(null);
    store.setRange({ start: '2026-09-21', end: '2026-09-28', view: 'week' });
    await settle();
    http.expectOne((request) => request.url.startsWith(`${BOOK}/odata`)).flush({ value: [ROW] });
    await settle();
    expect(store.events().map((event) => event.id)).toEqual(['a1']);

    company.set({ id: 'bbbb0000-0000-4000-8000-00000000beef', name: 'Άλλο' });
    await settle();

    expect(store.events()).toEqual([]);
    http.expectOne((request) => request.url.startsWith(`${BOOK}/calendar-options`)).flush(OPTIONS);
    http.expectOne((request) => request.url.startsWith(`${BOOK}/odata`)).flush({ value: [] });
  });

  it('asks for nothing while the account has no shop', async () => {
    company.set(null);
    await hydrate(null);
    store.setRange({ start: '2026-09-21', end: '2026-09-28', view: 'week' });
    await settle();

    http.expectNone((request) => request.url.startsWith(BOOK));
    expect(store.customers()).toBeUndefined();
  });

  it('reads counts, not appointments, in year view', async () => {
    await hydrate(null);
    store.setRange({ start: '2026-01-01', end: '2027-01-01', view: 'year' });
    await settle();

    const request = http.expectOne((candidate) => candidate.url.startsWith(`${BOOK}/odata`));
    expect(decodeURIComponent(request.request.url)).toContain(
      '$apply=filter(localDate ge 2026-01-01',
    );
    request.flush({ value: [{ localDate: '2026-01-05', count: 3 }] });
    await settle();

    expect(store.dayCounts()).toEqual({ '2026-01-05': 3 });
  });

  it('keeps drawing the last load while the next range loads', async () => {
    await hydrate(null);
    store.setRange({ start: '2026-09-21', end: '2026-09-28', view: 'week' });
    await settle();
    http.expectOne((request) => request.url.startsWith(`${BOOK}/odata`)).flush({ value: [ROW] });
    await settle();
    expect(store.events().map((event) => event.id)).toEqual(['a1']);

    store.setRange({ start: '2026-09-22', end: '2026-09-23', view: 'day' });
    await settle();

    expect(store.events().map((event) => event.id)).toEqual(['a1']);
    expect(store.events()[0]?.badge?.label).toBe('Σε αναμονή');
    http.expectOne((request) => request.url.startsWith(`${BOOK}/odata`)).flush({ value: [] });
  });

  it('does not echo the stored settings back, and writes a change once', async () => {
    const stored = WEEK_SETTINGS;
    await hydrate(stored);
    await settle(450);
    http.expectNone((request) => request.method === 'PATCH');

    store.timeScale.set(10);
    store.timeScale.set(60);
    await settle(450);

    const write = http.expectOne(`${RESOURCES}/settings-1`);
    expect(write.request.method).toBe('PATCH');
    expect(write.request.body).toEqual({ value: { ...stored, timeScale: 60 } });
    write.flush({});
  });

  it('falls back to the defaults when the settings cannot be read', async () => {
    const done = store.hydrate({}, false, Promise.resolve(null));
    http
      .expectOne((request) => request.url.startsWith(`${RESOURCES}/odata`))
      .error(new ProgressEvent('offline'));
    await done;
    await settle();

    expect(store.ready()).toBe(true);
    expect(store.view()).toBe('week');
    store.timeScale.set(60);
    await settle(450);
    // An unread resource is never written: a create could duplicate one that exists.
    http.expectNone((request) => request.url.startsWith(RESOURCES));
  });

  it('writes a change made just before the page closes', async () => {
    const injector = createEnvironmentInjector(
      [CalendarStore],
      TestBed.inject(EnvironmentInjector),
    );
    const closing = injector.get(CalendarStore);
    await settle();
    http.expectOne((request) => request.url.startsWith(`${BOOK}/calendar-options`)).flush(OPTIONS);
    const done = closing.hydrate({}, false, Promise.resolve(null));
    http
      .expectOne((request) => request.url.startsWith(`${RESOURCES}/odata`))
      .flush({ value: [{ id: 'settings-1', name: 'calendar_settings', value: WEEK_SETTINGS }] });
    await done;
    await settle();

    closing.view.set('year');
    await settle();
    injector.destroy();
    await settle(450);

    const write = http.expectOne(`${RESOURCES}/settings-1`);
    expect(write.request.body).toEqual({ value: { ...WEEK_SETTINGS, view: 'year' } });
    write.flush({});
  });

  it('keeps a panel opened over the calendar out of the settings', async () => {
    await hydrate(null);
    store.setPanel('filters', true);
    await settle(450);

    http.expectNone((request) => request.method === 'POST');
    expect(store.panel()).toBe('filters');
    expect(localStorage.getItem(PANEL_KEY)).toBeNull();
  });

  it('remembers a panel left open in the browser, not in the settings', async () => {
    await hydrate(WEEK_SETTINGS);
    store.setPanel('filters', false);
    await settle(450);

    expect(localStorage.getItem(PANEL_KEY)).toBe('filters');
    http.expectNone((request) => request.url.startsWith(RESOURCES));
  });

  // A panel that came with the settings slid in after the calendar was already drawn.
  it('opens a panel left open on the first frame, before the settings land', async () => {
    localStorage.setItem(PANEL_KEY, 'settings');
    const injector = createEnvironmentInjector(
      [CalendarStore],
      TestBed.inject(EnvironmentInjector),
    );
    const arriving = injector.get(CalendarStore);

    expect(arriving.panel()).toBe('settings');
    await settle();
    http.expectOne((request) => request.url.startsWith(`${BOOK}/calendar-options`)).flush(OPTIONS);
    injector.destroy();
  });

  // A view that came with the settings replaced the default view already on screen.
  it('draws the view this browser last showed, before the settings land', async () => {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify({ ...WEEK_SETTINGS, view: 'month' }));
    const injector = createEnvironmentInjector(
      [CalendarStore],
      TestBed.inject(EnvironmentInjector),
    );
    const arriving = injector.get(CalendarStore);
    void arriving.hydrate({}, true, Promise.resolve(null));

    expect(arriving.view()).toBe('month');
    await settle();
    http.expectOne((request) => request.url.startsWith(`${BOOK}/calendar-options`)).flush(OPTIONS);
    http
      .expectOne((request) => request.url.startsWith(`${RESOURCES}/odata`))
      .flush({ value: [{ id: 'settings-1', name: 'calendar_settings', value: WEEK_SETTINGS }] });
    await settle();
    // The server copy still wins: another device changed it.
    expect(arriving.view()).toBe('week');
    injector.destroy();
  });

  it('keeps the settings in effect in the browser', async () => {
    await hydrate(WEEK_SETTINGS, { defaultView: { ...BARBER_VIEW, view: 'month' } });
    expect(JSON.parse(localStorage.getItem(SETTINGS_KEY) ?? 'null')).toEqual({
      ...WEEK_SETTINGS,
      view: 'month',
    });

    store.view.set('day');
    await settle(450);
    expect(JSON.parse(localStorage.getItem(SETTINGS_KEY) ?? 'null')).toEqual({
      ...WEEK_SETTINGS,
      view: 'day',
    });
    http.expectOne(`${RESOURCES}/settings-1`).flush({});
  });
});
