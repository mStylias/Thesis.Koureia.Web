import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { PUBLIC_TRANSFERABLE } from '@api/core';
import { provideSynaxApi } from '@synax/client';
import { Result } from '@synax/client/core';

import { BarbershopsApi } from './barbershops.api';
import { companyDetails } from '../barbershop-home/barbershop-home.fixture';
import type {
  BarbershopFilters,
  CompanyCardResponse,
  CompanyDetailsResponse,
} from './barbershops.api.types';

const BASE = 'https://api.test/api/v1';
const NO_FILTERS: BarbershopFilters = { name: '', date: null, origin: null };

function shop(overrides: Partial<CompanyCardResponse> = {}): CompanyCardResponse {
  return {
    id: 'shop-1',
    slug: 'koureio-akropoli',
    name: 'Κουρείο Ακρόπολη',
    description: null,
    street: 'Διονυσίου Αρεοπαγίτου 5',
    city: 'Αθήνα',
    region: 'Αττική',
    postalCode: '11742',
    countryCode: 'GR',
    logoUrl: null,
    mainPhotoUrl: null,
    latitude: 37.9715,
    longitude: 23.7257,
    distanceMeters: 420,
    timezone: 'Europe/Athens',
    currency: 'EUR',
    slotIntervalMinutes: 15,
    primaryBusinessTypeCode: 'barbershop',
    ...overrides,
  };
}

describe('BarbershopsApi', () => {
  let api: BarbershopsApi;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideSynaxApi({ baseUrl: 'https://api.test', defaultVersion: 1 }),
      ],
    });
    api = TestBed.inject(BarbershopsApi);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    http.verify();
  });

  it('reads the cached whole list when nothing is filtered', () => {
    api.list(NO_FILTERS, 'el').subscribe();

    const request = http.expectOne(`${BASE}/companies/all?languageCode=el`);
    expect(request.request.method).toBe('GET');
  });

  it('reads the filtered route once a filter is set, and sends only what is set', () => {
    api.list({ name: '  Ακρόπολη  ', date: null, origin: null }, 'el').subscribe();

    // The name is trimmed and `date` is absent, not empty: the server drops an absent
    // condition and would match an empty one against every name.
    const request = http.expectOne(
      `${BASE}/companies?languageCode=el&search=%CE%91%CE%BA%CF%81%CF%8C%CF%80%CE%BF%CE%BB%CE%B7`,
    );
    expect(request.request.params.has('date')).toBe(false);
  });

  it('sends the date, and treats whitespace alone as no name', () => {
    api.list({ name: '   ', date: '2026-09-09', origin: null }, 'en').subscribe();

    const request = http.expectOne((candidate) => candidate.url === `${BASE}/companies`);
    expect(request.request.params.get('date')).toBe('2026-09-09');
    expect(request.request.params.has('search')).toBe(false);
    expect(request.request.params.get('languageCode')).toBe('en');
  });

  it('lets the response cross hydration', () => {
    // Without this the server render of the page is refetched the moment the browser starts.
    api.list(NO_FILTERS, 'el').subscribe();

    const request = http.expectOne(`${BASE}/companies/all?languageCode=el`);
    expect(request.request.context.get(PUBLIC_TRANSFERABLE)).toBe(true);
  });

  it('reports the shops as a successful result', () => {
    let received: Result<CompanyCardResponse[]> | undefined;
    api.list(NO_FILTERS, 'el').subscribe((result) => (received = result));

    http.expectOne(`${BASE}/companies/all?languageCode=el`).flush([shop()]);

    expect(received?.isSuccess).toBe(true);
    expect(received?.data).toHaveLength(1);
  });

  it('turns an empty 204 into an empty list rather than null', () => {
    let received: Result<CompanyCardResponse[]> | undefined;
    api.list(NO_FILTERS, 'el').subscribe((result) => (received = result));

    http
      .expectOne(`${BASE}/companies/all?languageCode=el`)
      .flush(null, { status: 204, statusText: 'No Content' });

    expect(received?.data).toEqual([]);
  });

  it('reports a failure as a value, never as a thrown error', () => {
    let received: Result<CompanyCardResponse[]> | undefined;
    api.list(NO_FILTERS, 'el').subscribe((result) => (received = result));

    http
      .expectOne(`${BASE}/companies/all?languageCode=el`)
      .flush(
        { errorCode: 'COMPANIES_ALL_FETCH_FAILED', detail: 'Failed to fetch the barbershop list.' },
        { status: 500, statusText: 'Internal Server Error' },
      );

    expect(received?.isFailure).toBe(true);
    expect(received?.error?.httpCode).toBe(500);
  });

  describe('details', () => {
    it('reads one shop by its slug, in the page language', () => {
      let received: Result<CompanyDetailsResponse> | undefined;
      api.details('barber-house-kolonaki', 'en').subscribe((result) => (received = result));

      http
        .expectOne(`${BASE}/companies/barber-house-kolonaki?languageCode=en`)
        .flush(companyDetails());

      expect(received?.isSuccess).toBe(true);
      expect(received?.data?.name).toBe('Barber House Κολωνάκι');
    });

    it('encodes the slug, so a pasted address cannot reach another route', () => {
      api.details('a/b?c', 'el').subscribe();

      http.expectOne(`${BASE}/companies/a%2Fb%3Fc?languageCode=el`);
    });

    it('lets the response cross hydration', () => {
      api.details('barber-house-kolonaki', 'el').subscribe();

      const request = http.expectOne(`${BASE}/companies/barber-house-kolonaki?languageCode=el`);
      expect(request.request.context.get(PUBLIC_TRANSFERABLE)).toBe(true);
    });

    it('reports an unknown slug as a 404 failure, not a thrown error', () => {
      let received: Result<CompanyDetailsResponse> | undefined;
      api.details('nowhere', 'el').subscribe((result) => (received = result));

      http
        .expectOne(`${BASE}/companies/nowhere?languageCode=el`)
        .flush({ errorCode: 'COMPANY_NOT_FOUND' }, { status: 404, statusText: 'Not Found' });

      expect(received?.isFailure).toBe(true);
      expect(received?.error?.httpCode).toBe(404);
    });
  });
});
