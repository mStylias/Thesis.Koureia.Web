/**
 * The page against one HTTP boundary: the URL of each grid query that left the app.
 *
 * What matters is what the endpoint receives: the opening filter in shop time, the customer
 * view instead of it, and exactly one grid query either way.
 */
import { Injectable, signal } from '@angular/core';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import {
  provideTransloco,
  Translation,
  TranslocoLoader,
  TranslocoService,
} from '@jsverse/transloco';
import { StaffAccessStore } from '@auth/data-access';
import { appointmentsInlineLoader } from '@features/management-shared-appointments';
import { provideSynaxApi } from '@synax/client';
import { startOfZonedDay } from '@ui/datagrid';
import { memorySavedViewsStorage, provideSavedViewsStorage } from '@ui/saved-views/core';
import { BehaviorSubject, firstValueFrom, of, type Observable } from 'rxjs';

import { appointmentsGridInlineLoader } from '../appointments.i18n';
import { AppointmentsStore } from '../appointments.store';
import { AppointmentsList } from './appointments-list';

const BASE = 'http://api.test';
const GRID = `${BASE}/api/v1/appointments/odata`;
const OPTIONS = `${BASE}/api/v1/appointments/calendar-options`;
const CUSTOMERS = `${BASE}/api/v1/appointments/customers/odata`;
const ZONE = 'Pacific/Kiritimati';
const CUSTOMER = 'c0ffee00-0000-4000-8000-000000000001';

@Injectable()
class EmptyLoader implements TranslocoLoader {
  getTranslation(): Observable<Translation> {
    return of({});
  }
}

describe('the appointments page', () => {
  let fixture: ComponentFixture<AppointmentsList>;
  let http: HttpTestingController;

  /**
   * Mounts the page and answers the reads it starts on arrival: the shop's options and, for
   * `?customer=`, the customer's name. Both land before the stored views, as they do in the app.
   */
  async function create(query: Record<string, string>, customerName?: string) {
    const params = new BehaviorSubject(convertToParamMap(query));
    await TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        provideSynaxApi({ baseUrl: BASE, defaultVersion: 1 }),
        provideSavedViewsStorage(memorySavedViewsStorage()),
        { provide: StaffAccessStore, useValue: { company: signal({ id: 'shop', name: 'Shop' }) } },
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: { queryParamMap: params.value, data: {} },
            queryParamMap: params.asObservable(),
          },
        },
        AppointmentsStore,
        provideTransloco({
          config: { availableLangs: ['el', 'en'], defaultLang: 'el', fallbackLang: 'en' },
          loader: EmptyLoader,
        }),
      ],
    }).compileComponents();

    // What the route's resolver does before the page renders.
    const transloco = TestBed.inject(TranslocoService);
    await firstValueFrom(
      transloco.load('managementAppointmentsGrid/el', {
        inlineLoader: appointmentsGridInlineLoader,
      }),
    );
    await firstValueFrom(
      transloco.load('managementAppointments/el', { inlineLoader: appointmentsInlineLoader }),
    );

    fixture = TestBed.createComponent(AppointmentsList);
    http = TestBed.inject(HttpTestingController);
    http
      .expectOne((candidate) => candidate.url.startsWith(OPTIONS))
      .flush({
        timezone: ZONE,
        slotIntervalMinutes: 15,
        businessHours: [],
        staffMembers: [],
        serviceCategories: [],
      });
    if (customerName !== undefined) {
      http
        .expectOne((candidate) => candidate.url.startsWith(CUSTOMERS))
        .flush({ value: [{ id: CUSTOMER, displayName: customerName }] });
    }
    fixture.detectChanges();
    await settle();
  }

  afterEach(() => {
    http.verify();
  });

  async function settle(): Promise<void> {
    for (let pass = 0; pass < 3; pass += 1) {
      await new Promise((resolve) => setTimeout(resolve, 0));
      fixture.detectChanges();
    }
  }

  /** Every grid query sent so far, answered empty, decoded for reading. */
  async function gridQueries(): Promise<string[]> {
    await settle();
    const requests = http.match((candidate) => candidate.url.startsWith(GRID));
    for (const request of requests) {
      request.flush({ value: [], '@odata.count': 0 });
    }
    await settle();
    return requests.map((request) => decodeURIComponent(request.request.urlWithParams));
  }

  it('opens on the upcoming appointments, in shop time, soonest first', async () => {
    await create({});
    const queries = await gridQueries();

    expect(queries).toHaveLength(1);
    const today = startOfZonedDay(new Date(), 0, ZONE).toISOString();
    expect(queries[0]).toContain(`$filter=startsAt ge ${today}`);
    expect(queries[0]).toContain('$orderby=startsAt');
    expect(queries[0]).not.toContain('startsAt desc');
    expect(queries[0]).toContain('$top=25');
    expect(queries[0]).toContain('$count=true');
    expect(queries[0]).toContain('languageCode=el');
  });

  it("opens a customer's view instead, with one query and no upcoming filter", async () => {
    await create({ customer: CUSTOMER }, 'Γιώργος Π.');
    const queries = await gridQueries();

    expect(queries).toHaveLength(1);
    expect(queries[0]).toContain(`$filter=customerId eq ${CUSTOMER}`);
    expect(queries[0]).toContain('$orderby=startsAt desc');
    expect(queries[0]).not.toContain('startsAt ge');
  });

  it("names the customer's view and marks it as created automatically", async () => {
    await create({ customer: CUSTOMER }, 'Γιώργος Π.');
    await gridQueries();
    await import('@ui/saved-views');
    await settle();

    const tab = (fixture.nativeElement as HTMLElement).querySelector('[data-temporary-id]');
    expect(tab?.textContent).toContain('Γιώργος Π.');
  });

  it("opens the customer's view unchanged, with nothing to revert", async () => {
    await create({ customer: CUSTOMER }, 'Γιώργος Π.');
    await gridQueries();
    await import('@ui/saved-views');
    await settle();

    const root = fixture.nativeElement as HTMLElement;
    expect(root.querySelector('.sv-tab-dirty')).toBeNull();
  });
});
