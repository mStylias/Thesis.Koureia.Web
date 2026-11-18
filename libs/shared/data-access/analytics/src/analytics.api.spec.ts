import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideSynaxApi } from '@synax/client';
import { firstValueFrom, type Observable } from 'rxjs';

import { AnalyticsApi } from './analytics.api';
import type { AnalyticsQueryParameters } from './analytics.types';

const API = 'https://api.test/api/v1';
const RANGE: AnalyticsQueryParameters = { from: '2026-09-01', to: '2026-09-30' };
const DATES = 'from=2026-09-01&to=2026-09-30';

describe('AnalyticsApi', () => {
  let api: AnalyticsApi;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideSynaxApi({ baseUrl: 'https://api.test', defaultVersion: 1 }),
      ],
    });
    api = TestBed.inject(AnalyticsApi);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    http.verify();
  });

  it.each([
    ['overview', 'overview'],
    ['revenue', 'revenue'],
    ['demand', 'demand'],
    ['team', 'team'],
    ['services', 'services'],
    ['customers', 'customers'],
    ['lostBusiness', 'lost-business'],
    ['quality', 'quality'],
  ] as const)('reads %s from analytics/%s with the dates only', (method, route) => {
    const read: (query: AnalyticsQueryParameters) => Observable<unknown> = api[method].bind(api);
    read(RANGE).subscribe();

    const request = http.expectOne(`${API}/analytics/${route}?${DATES}`);
    expect(request.request.method).toBe('GET');
    request.flush({});
  });

  it('sends every set field, with the enums in PascalCase', () => {
    api
      .revenue({
        ...RANGE,
        granularity: 'Week',
        compareTo: 'PreviousYear',
        staffMemberId: '7d1c2a40-0000-4000-8000-000000000001',
        languageCode: 'el',
      })
      .subscribe();

    http
      .expectOne(
        `${API}/analytics/revenue?${DATES}&granularity=Week&compareTo=PreviousYear` +
          '&staffMemberId=7d1c2a40-0000-4000-8000-000000000001&languageCode=el',
      )
      .flush({});
  });

  it('omits the fields that are null or empty', () => {
    api
      .quality({
        ...RANGE,
        granularity: null,
        compareTo: null,
        staffMemberId: '',
        languageCode: 'en',
      })
      .subscribe();

    http.expectOne(`${API}/analytics/quality?${DATES}&languageCode=en`).flush({});
  });

  it('never sends limit or days', () => {
    api.customers({ ...RANGE, compareTo: 'PreviousPeriod' }).subscribe();

    const request = http.expectOne(() => true);
    expect(request.request.urlWithParams).toBe(
      `${API}/analytics/customers?${DATES}&compareTo=PreviousPeriod`,
    );
    expect(request.request.urlWithParams).not.toMatch(/limit|days/);
    request.flush({});
  });

  it('returns a refusal as a failed result', async () => {
    const result = firstValueFrom(api.overview(RANGE));

    http
      .expectOne(`${API}/analytics/overview?${DATES}`)
      .flush(
        { status: 400, title: 'ANALYTICS_STAFF_MEMBER_NOT_FOUND' },
        { status: 400, statusText: 'Bad Request' },
      );

    expect((await result).isSuccess).toBe(false);
  });
});
