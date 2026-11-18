import { HttpClient, provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom, of, Subject } from 'rxjs';
import {
  HttpError,
  ODataPage,
  ODataQuery,
  odataQueryString,
  ODataResult,
  Result,
} from '@synax/client/core';
import { ODataSource, toODataResult } from './index';

interface Restaurant {
  name: string;
}

describe('toODataResult', () => {
  let http: HttpClient;
  let controller: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    http = TestBed.inject(HttpClient);
    controller = TestBed.inject(HttpTestingController);
  });
  afterEach(() => {
    controller.verify();
  });

  it('normalizes the OData envelope into a successful Result', async () => {
    const pending = firstValueFrom(
      http
        .get<ODataPage<Restaurant>>('/api/v1/restaurants/search', { params: { $count: 'true' } })
        .pipe(toODataResult()),
    );
    controller
      .expectOne((r) => r.url === '/api/v1/restaurants/search')
      .flush({
        '@odata.context': '/odata/$metadata#restaurants',
        value: [{ name: 'La Tavola' }],
        '@odata.count': 1,
        '@odata.nextLink': '/api/v1/restaurants/search?$skiptoken=name-La%20Tavola',
      });

    const result = await pending;
    expect(Result.hasData(result) && result.data.totalCount).toBe(1);
    expect(Result.hasData(result) && result.data.items[0].name).toBe('La Tavola');
    expect(Result.hasData(result) && result.data.context).toBe('/odata/$metadata#restaurants');
    expect(Result.hasData(result) && result.data.nextLink).toBe(
      '/api/v1/restaurants/search?$skiptoken=name-La%20Tavola',
    );
  });

  it('maps an invalid client query to INVALID_ODATA_QUERY without erroring the stream', async () => {
    const pending = firstValueFrom(
      http.get<ODataPage<Restaurant>>('/api/v1/restaurants/search').pipe(toODataResult()),
    );
    // The problem body the OData bridge produces for a bad $filter.
    controller.expectOne('/api/v1/restaurants/search').flush(
      {
        title: 'INVALID_ODATA_QUERY',
        status: 400,
        detail: "The OData query is invalid: Could not find a property named 'bogus'.",
      },
      { status: 400, statusText: 'Bad Request' },
    );

    const result = await pending;
    expect(result.isFailure && result.error.errorCode).toBe('INVALID_ODATA_QUERY');
    expect(result.isFailure && result.error.httpCode).toBe(400);
  });
});

describe('ODataSource', () => {
  const page = (items: string[], totalCount: number | null): ODataResult<string> => ({
    items,
    totalCount,
  });

  it('pages with $top/$skip and exposes the $count total', () => {
    const seen: ODataQuery<string>[] = [];
    const source = new ODataSource<string>(
      (query) => {
        seen.push(query);
        return of(Result.Ok(page(['a', 'b'], 5)));
      },
      { pageSize: 2, orderBy: 'name' },
    );

    source.load();
    expect(source.items()).toEqual(['a', 'b']);
    expect(source.totalCount()).toBe(5);
    expect(source.totalPages()).toBe(3);
    expect(source.hasPreviousPage()).toBe(false);
    expect(source.hasNextPage()).toBe(true);

    source.nextPage();
    expect(source.page()).toBe(2);
    expect(seen).toEqual([
      {
        filter: undefined,
        orderBy: 'name',
        top: 2,
        skip: 0,
        count: true,
        select: undefined,
        expand: undefined,
      },
      {
        filter: undefined,
        orderBy: 'name',
        top: 2,
        skip: 2,
        count: true,
        select: undefined,
        expand: undefined,
      },
    ]);
  });

  it('falls back to a full-page heuristic when $count is off', () => {
    let items = ['a', 'b'];
    const source = new ODataSource<string>(() => of(Result.Ok(page(items, null))), {
      pageSize: 2,
      count: false,
    });

    source.load();
    expect(source.totalPages()).toBe(0);
    expect(source.hasNextPage()).toBe(true);

    items = ['c'];
    source.nextPage();
    expect(source.hasNextPage()).toBe(false);
  });

  it('resets to page 1 when the filter changes', () => {
    const seen: ODataQuery<string>[] = [];
    const source = new ODataSource<string>(
      (query) => {
        seen.push(query);
        return of(Result.Ok(page([], 0)));
      },
      { pageSize: 2, page: 3 },
    );

    source.setFilter("contains(name,'Tav')");
    expect(source.page()).toBe(1);
    expect(seen[0].skip).toBe(0);
    expect(seen[0].filter).toBe("contains(name,'Tav')");
  });

  it('carries a structured filter through to the query unserialized', () => {
    // The source holds the filter as data and the fetch serializes it. That lets the caller
    // escape values with odataQueryString instead of concatenating them.
    const seen: ODataQuery<Restaurant>[] = [];
    const source = new ODataSource<Restaurant>((query) => {
      seen.push(query);
      return of(Result.Ok({ items: [], totalCount: 0 }));
    });

    source.setFilter({ name: { contains: "O'Brien" } });

    expect(seen[0].filter).toEqual({ name: { contains: "O'Brien" } });
    expect(odataQueryString(seen[0])).toContain("contains(name,'O''Brien')");
  });

  it('surfaces failures and cancels an in-flight load', () => {
    const gate = new Subject<Result<ODataResult<string>, HttpError>>();
    let calls = 0;
    const source = new ODataSource<string>(() => {
      calls++;
      return gate.asObservable();
    });

    source.load();
    source.load(); // cancels the first
    expect(calls).toBe(2);
    expect(source.loading()).toBe(true);

    gate.next(
      Result.Fail({ errorCode: 'INVALID_ODATA_QUERY', httpCode: 400, validationErrors: [] }),
    );
    expect(source.error()?.errorCode).toBe('INVALID_ODATA_QUERY');
    expect(source.loading()).toBe(false);
  });
});
