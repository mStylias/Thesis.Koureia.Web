import { ApplicationRef, Injector } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { DataStore, connectDataStore } from './data.store';
import { QueryStore } from './query.store';
import { where } from './filter/filter-node';
import type {
  DistinctValuesRequest,
  GridDataSource,
  Query,
  QueryResult,
} from './types/query.types';

interface Row {
  id: number;
  name: string;
  age: number;
}

const ROWS: Row[] = [
  { id: 1, name: 'Anna', age: 34 },
  { id: 2, name: 'Basil', age: 27 },
  { id: 3, name: 'Chloe', age: 41 },
  { id: 4, name: 'Dora', age: 19 },
];

class FakeSource implements GridDataSource<Row> {
  readonly queries: Query[] = [];
  constructor(
    private readonly handler: (query: Query) => Promise<QueryResult<Row>> = (query) =>
      Promise.resolve({ rows: ROWS, totalCount: ROWS.length, ...pageEcho(query) }),
  ) {}

  load(query: Query): Promise<QueryResult<Row>> {
    this.queries.push(query);
    return this.handler(query);
  }
}

function pageEcho(query: Query): Partial<QueryResult<Row>> {
  if (query.skip == null && query.take == null) {
    return {};
  }
  const start = query.skip ?? 0;
  return { rows: ROWS.slice(start, query.take != null ? start + query.take : undefined) };
}

function deferred<T>(): {
  promise: Promise<T>;
  resolve: (value: T) => void;
  reject: (error: unknown) => void;
} {
  const handlers: { resolve?: (value: T) => void; reject?: (error: unknown) => void } = {};
  const promise = new Promise<T>((resolve, reject) => {
    handlers.resolve = resolve;
    handlers.reject = reject;
  });
  return {
    promise,
    resolve: (value) => handlers.resolve?.(value),
    reject: (error) => handlers.reject?.(error),
  };
}

function wait(milliseconds: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, milliseconds);
  });
}

describe('DataStore', () => {
  it('runs the full local engine over an array source', async () => {
    const store = new DataStore<Row>(ROWS);
    await store.schedule({
      filter: where('age', 'gt', 20),
      sort: [{ field: 'age' }],
      skip: 0,
      take: 2,
      requireTotalCount: true,
    });
    expect(store.rows().map((row) => row.id)).toEqual([2, 1]);
    expect(store.totalCount()).toBe(3);
    expect(store.error()).toBeNull();
  });

  it('coalesces schedules from the same microtask into one request with the latest query', async () => {
    const source = new FakeSource();
    const store = new DataStore<Row>(source);
    void store.schedule({ search: 'first' });
    await store.schedule({ search: 'second' });
    expect(source.queries).toHaveLength(1);
    expect(source.queries[0]?.search).toBe('second');
  });

  it('skips a query identical to the last issued one', async () => {
    const source = new FakeSource();
    const store = new DataStore<Row>(source);
    await store.schedule({ sort: [{ field: 'name' }] });
    await store.schedule({ sort: [{ field: 'name' }] });
    expect(source.queries).toHaveLength(1);
  });

  it('re-issues an identical query when forced', async () => {
    const source = new FakeSource();
    const store = new DataStore<Row>(source);
    await store.schedule({ sort: [{ field: 'name' }] });
    await store.schedule({ sort: [{ field: 'name' }] }, { force: true });
    expect(source.queries).toHaveLength(2);
  });

  it('holds a forced load open until the floor elapses, rows and all', async () => {
    const source = new FakeSource();
    const store = new DataStore<Row>(source);
    store.setMinRefreshDuration(60);
    await store.schedule({ sort: [{ field: 'name' }] });
    store.setRows([]);

    const started = Date.now();
    const load = store.schedule({ sort: [{ field: 'name' }] }, { force: true });
    // The response has landed by now; the floor is what is still holding.
    await new Promise((resolve) => {
      setTimeout(resolve, 10);
    });
    expect(store.rows()).toHaveLength(0);
    expect(store.loading()).toBe(true);

    await load;
    expect(Date.now() - started).toBeGreaterThanOrEqual(55);
    expect(store.rows()).toHaveLength(ROWS.length);
    expect(store.loading()).toBe(false);
  });

  it('reports a fast first load at once and holds it for the floor', async () => {
    const source = new FakeSource();
    const store = new DataStore<Row>(source);
    store.setInitialLoadingFloor(60);

    const started = Date.now();
    const load = store.schedule({ sort: [{ field: 'name' }] });
    await wait(10);
    // The response has landed. The floor is what keeps the placeholder up.
    expect(store.initialLoadingVisible()).toBe(true);
    expect(store.rows()).toHaveLength(0);

    await load;
    expect(Date.now() - started).toBeGreaterThanOrEqual(55);
    expect(store.rows()).toHaveLength(ROWS.length);
    expect(store.initialLoadingVisible()).toBe(false);
  });

  it('counts the floor from a report raised before the first query', async () => {
    const store = new DataStore<Row>(new FakeSource());
    store.setInitialLoadingFloor(100);

    store.reportInitialLoad();
    expect(store.initialLoadingVisible()).toBe(true);
    await wait(80);

    const started = Date.now();
    await store.schedule({ sort: [{ field: 'name' }] });
    // Only the rest of the floor is left to wait out.
    expect(Date.now() - started).toBeLessThan(60);
    expect(store.rows()).toHaveLength(ROWS.length);
    expect(store.initialLoadingVisible()).toBe(false);
  });

  it('draws no placeholder for array data', async () => {
    const store = new DataStore<Row>(ROWS);
    store.setInitialLoadingFloor(100);

    store.reportInitialLoad();
    expect(store.initialLoadingVisible()).toBe(false);

    const started = Date.now();
    await store.schedule({ sort: [{ field: 'name' }] });
    expect(Date.now() - started).toBeLessThan(50);
    expect(store.rows()).toHaveLength(ROWS.length);
  });

  it('holds a reported first load for its floor, rows and all', async () => {
    const answer = deferred<QueryResult<Row>>();
    const source = new FakeSource(() => answer.promise);
    const store = new DataStore<Row>(source);
    store.setInitialLoadingFloor(150);

    const started = Date.now();
    const load = store.schedule({ sort: [{ field: 'name' }] });
    await wait(40);
    expect(store.initialLoadingVisible()).toBe(true);

    answer.resolve({ rows: ROWS, totalCount: ROWS.length });
    await wait(20);
    // The response has landed; the floor is what still holds the rows back.
    expect(store.rows()).toHaveLength(0);
    expect(store.initialLoadingVisible()).toBe(true);

    await load;
    expect(Date.now() - started).toBeGreaterThanOrEqual(145);
    expect(store.rows()).toHaveLength(ROWS.length);
    expect(store.initialLoadingVisible()).toBe(false);
  });

  it('holds a first load that fails for the same floor', async () => {
    const answer = deferred<QueryResult<Row>>();
    const source = new FakeSource(() => answer.promise);
    const store = new DataStore<Row>(source);
    store.setInitialLoadingFloor(150);

    const started = Date.now();
    const load = store.schedule({ sort: [{ field: 'name' }] });
    await wait(40);
    answer.reject(new Error('gone'));

    await load;
    expect(Date.now() - started).toBeGreaterThanOrEqual(145);
    expect(store.error()?.message).toBe('gone');
    expect(store.initialLoadingVisible()).toBe(false);
  });

  it('leaves the report up while a superseded first load is replaced', async () => {
    const first = deferred<QueryResult<Row>>();
    const second = deferred<QueryResult<Row>>();
    let call = 0;
    const source = new FakeSource(() => {
      call += 1;
      return call === 1 ? first.promise : second.promise;
    });
    const store = new DataStore<Row>(source);
    store.setInitialLoadingFloor(150);

    void store.schedule({ search: 'slow' });
    await wait(40);
    expect(store.initialLoadingVisible()).toBe(true);

    const load = store.schedule({ search: 'fast' });
    await wait(10);
    // Same first load to the reader: the placeholder must not blink between
    // the two requests.
    expect(store.initialLoadingVisible()).toBe(true);

    second.resolve({ rows: ROWS.slice(0, 1) });
    await load;
    expect(store.initialLoadingVisible()).toBe(false);
    expect(store.rows()).toHaveLength(1);
    first.resolve({ rows: ROWS });
  });

  it('leaves an ordinary load alone, which shows its own result', async () => {
    const source = new FakeSource();
    const store = new DataStore<Row>(source);
    store.setMinRefreshDuration(200);
    const started = Date.now();
    await store.schedule({ sort: [{ field: 'name' }] });
    expect(Date.now() - started).toBeLessThan(100);
    expect(store.rows()).toHaveLength(ROWS.length);
  });

  it('aborts a superseded request and ignores its late result', async () => {
    const first = deferred<QueryResult<Row>>();
    let call = 0;
    const source = new FakeSource((query) => {
      call += 1;
      if (call === 1) {
        return first.promise.then((result) => {
          if (query.signal?.aborted) {
            throw new Error('aborted');
          }
          return result;
        });
      }
      return Promise.resolve({ rows: ROWS.slice(0, 1) });
    });
    const store = new DataStore<Row>(source);
    void store.schedule({ search: 'slow' });
    // Drain microtasks so the first request is in flight, then supersede it.
    await new Promise((resolve) => {
      setTimeout(resolve, 0);
    });
    await store.schedule({ search: 'fast' });
    expect(source.queries[0]?.signal?.aborted).toBe(true);
    first.resolve({ rows: ROWS });
    await first.promise.catch(() => undefined);
    await Promise.resolve();
    expect(store.rows().map((row) => row.id)).toEqual([1]);
    expect(store.loading()).toBe(false);
  });

  it('reports a failed load as data and recovers on the next success', async () => {
    let fail = true;
    const seen: unknown[] = [];
    const source = new FakeSource((query) =>
      fail
        ? Promise.reject(new Error('boom'))
        : Promise.resolve({ rows: ROWS, ...pageEcho(query) }),
    );
    const store = new DataStore<Row>({
      source,
      onLoadError: (error) => {
        seen.push(error);
      },
    });
    await store.schedule({ search: 'x' });
    const error = store.error();
    if (error == null) {
      throw new Error('error not reported');
    }
    expect(error.message).toBe('boom');
    expect(error.query).toEqual({ search: 'x' });
    expect(error.query.signal).toBeUndefined();
    expect(store.settled()).toBe(true);
    expect(seen).toHaveLength(1);

    fail = false;
    await store.schedule({ search: 'x' }, { force: true });
    expect(store.error()).toBeNull();
    expect(store.rows()).toHaveLength(ROWS.length);
  });

  it('tracks loading and initial loading around the first settle', async () => {
    const gate = deferred<QueryResult<Row>>();
    const source = new FakeSource(() => gate.promise);
    const store = new DataStore<Row>(source);
    expect(store.initialLoading()).toBe(false);
    const settled = store.schedule({});
    await Promise.resolve();
    expect(store.loading()).toBe(true);
    expect(store.initialLoading()).toBe(true);
    gate.resolve({ rows: ROWS });
    await settled;
    expect(store.loading()).toBe(false);
    expect(store.initialLoading()).toBe(false);
    expect(store.settled()).toBe(true);
  });

  it('applies the query and result transforms in order', async () => {
    const source = new FakeSource((query) =>
      Promise.resolve({ rows: query.search === 'scoped' ? ROWS.slice(0, 2) : [] }),
    );
    const store = new DataStore<Row>({
      source,
      transformQuery: (query) => ({ ...query, search: 'scoped' }),
      transformResult: (result) => ({
        ...result,
        rows: result.rows.map((row) => ({ ...row, name: row.name.toUpperCase() })),
      }),
    });
    await store.schedule({});
    expect(store.rows().map((row) => row.name)).toEqual(['ANNA', 'BASIL']);
  });

  it('contains a failing query transform instead of leaving the load hanging', async () => {
    const source = new FakeSource();
    const store = new DataStore<Row>({
      source,
      transformQuery: () => {
        throw new Error('bad scope');
      },
    });
    await store.schedule({ search: 'x' });
    expect(store.error()?.message).toBe('bad scope');
    expect(store.loading()).toBe(false);
    expect(store.settled()).toBe(true);
    expect(source.queries).toHaveLength(0);
  });

  it('contains a failing result transform', async () => {
    const seen: unknown[] = [];
    const store = new DataStore<Row>({
      source: new FakeSource(),
      transformResult: () => {
        throw new Error('bad shape');
      },
      onLoadError: (error) => {
        seen.push(error);
      },
    });
    await store.schedule({});
    expect(store.error()?.message).toBe('bad shape');
    expect(store.loading()).toBe(false);
    expect(store.settled()).toBe(true);
    expect(seen).toHaveLength(1);
  });

  it('contains a failing comparator in a local post-process', async () => {
    const source = new FakeSource((query) => Promise.resolve({ rows: ROWS, ...pageEcho(query) }));
    const store = new DataStore<Row>(
      { source, remote: { paging: true, sorting: false } },
      {
        sortResolver: () => ({
          comparator: () => {
            throw new Error('bad comparator');
          },
        }),
      },
    );
    await store.schedule({ skip: 0, take: 4, sort: [{ field: 'age' }] });
    expect(store.error()?.message).toBe('bad comparator');
    expect(store.loading()).toBe(false);
    expect(store.settled()).toBe(true);
  });

  it('splits a hybrid query and runs the local operations over the returned rows', async () => {
    const source = new FakeSource((query) => Promise.resolve({ rows: ROWS, ...pageEcho(query) }));
    const store = new DataStore<Row>({ source, remote: { paging: true } });
    await store.schedule({
      skip: 0,
      take: 4,
      sort: [{ field: 'age', desc: true }],
      requireTotalCount: true,
    });
    const sent = source.queries[0];
    expect(sent.sort).toBeUndefined();
    expect(sent.skip).toBe(0);
    expect(sent.take).toBe(4);
    expect(store.rows().map((row) => row.id)).toEqual([3, 1, 2, 4]);
  });

  it('computes the total count locally when paging is local', async () => {
    const source = new FakeSource((query) => {
      expect(query.skip).toBeUndefined();
      expect(query.requireTotalCount).toBeUndefined();
      return Promise.resolve({ rows: ROWS });
    });
    const store = new DataStore<Row>({ source, remote: false });
    await store.schedule({
      filter: where('age', 'gt', 20),
      skip: 0,
      take: 2,
      requireTotalCount: true,
    });
    expect(store.totalCount()).toBe(3);
    expect(store.rows()).toHaveLength(2);
  });

  it('resets the settled flag and the dedup baseline when the source is replaced', async () => {
    const source = new FakeSource();
    const store = new DataStore<Row>(source);
    await store.schedule({ search: 'x' });
    expect(store.settled()).toBe(true);
    const replacement = new FakeSource();
    store.setData(replacement);
    expect(store.settled()).toBe(false);
    await store.schedule({ search: 'x' });
    expect(replacement.queries).toHaveLength(1);
    expect(store.settled()).toBe(true);
  });

  it('collects distinct values from the whole array instead of the filtered page', async () => {
    const store = new DataStore<Row>(ROWS);
    await store.schedule({ filter: where('age', 'gt', 40), take: 1 });

    const result = await store.loadDistinct({ field: 'name', filter: null });

    expect(result.origin).toBe('array');
    expect(result.partial).toBe(false);
    expect(result.values.map((entry) => entry.value)).toEqual(['Anna', 'Basil', 'Chloe', 'Dora']);
  });

  it('dispatches a named distinct request and caches an unchanged page', async () => {
    const requests: DistinctValuesRequest[] = [];
    const source: GridDataSource<Row> = {
      load: () => Promise.resolve({ rows: ROWS.slice(0, 1) }),
      loadDistinct: (request) => {
        requests.push(request);
        return Promise.resolve({ values: [{ value: 'Anna', count: 1 }] });
      },
    };
    const store = new DataStore<Row>(source);
    const request: DistinctValuesRequest = {
      field: 'name',
      filter: null,
      skip: 0,
      take: 51,
    };

    const first = await store.loadDistinct(request);
    const second = await store.loadDistinct(request);

    expect(first).toEqual(second);
    expect(first.origin).toBe('source');
    expect(requests).toHaveLength(1);
    expect(requests[0].filter).toBeNull();
    expect(requests[0].signal).toBeInstanceOf(AbortSignal);
  });

  it('marks the loaded-row fallback as partial', async () => {
    const source = new FakeSource(() => Promise.resolve({ rows: ROWS.slice(0, 2) }));
    const store = new DataStore<Row>(source);
    await store.schedule({ take: 2 });

    const result = await store.loadDistinct({ field: 'name', filter: null });

    expect(result.origin).toBe('loaded');
    expect(result.partial).toBe(true);
    expect(result.values.map((entry) => entry.value)).toEqual(['Anna', 'Basil']);
  });

  it('aborts an earlier distinct request when a new domain is requested', async () => {
    const signals: AbortSignal[] = [];
    const source: GridDataSource<Row> = {
      load: () => Promise.resolve({ rows: [] }),
      loadDistinct: (request) => {
        if (request.signal == null) {
          throw new Error('distinct request has no abort signal');
        }
        signals.push(request.signal);
        if (request.field === 'age') {
          return Promise.resolve({ values: [] });
        }
        return new Promise((_resolve, reject) => {
          request.signal?.addEventListener(
            'abort',
            () => {
              reject(new Error('aborted'));
            },
            { once: true },
          );
        });
      },
    };
    const store = new DataStore<Row>(source);

    const first = store.loadDistinct({ field: 'name' });
    const rejected = expect(first).rejects.toThrow('aborted');
    await Promise.resolve();
    await store.loadDistinct({ field: 'age' });

    await rejected;
    expect(signals[0].aborted).toBe(true);
  });
});

describe('connectDataStore', () => {
  async function flush(): Promise<void> {
    TestBed.inject(ApplicationRef).tick();
    await new Promise((resolve) => {
      setTimeout(resolve, 0);
    });
  }

  it('loads once per synchronous batch of facet changes and forces on reload', async () => {
    const source = new FakeSource();
    const queryStore = new QueryStore({ pageSize: 10 });
    const dataStore = new DataStore<Row>(source);
    connectDataStore(queryStore, dataStore, TestBed.inject(Injector));

    await flush();
    expect(source.queries).toHaveLength(1);

    queryStore.setSort([{ field: 'name' }]);
    queryStore.setFilter(where('age', 'gt', 20));
    queryStore.setSearch('a');
    await flush();
    expect(source.queries).toHaveLength(2);
    expect(source.queries[1]).toMatchObject({ search: 'a', skip: 0, take: 10 });

    queryStore.reload();
    await flush();
    expect(source.queries).toHaveLength(3);
  });

  it('re-materializes relative date filters on reload', async () => {
    const source = new FakeSource();
    const queryStore = new QueryStore();
    const dataStore = new DataStore<Row>(source);
    connectDataStore(queryStore, dataStore, TestBed.inject(Injector));
    queryStore.setRelativeDateFilter('created', {
      field: 'createdAt',
      filter: { direction: 'last', amount: 1, unit: 'hour' },
    });
    await flush();
    const firstFilter = source.queries.at(-1)?.filter;
    expect(firstFilter).toMatchObject({ field: 'createdAt', op: 'between' });

    await new Promise((resolve) => {
      setTimeout(resolve, 5);
    });
    queryStore.reload();
    await flush();
    const secondFilter = source.queries.at(-1)?.filter;
    expect(secondFilter).not.toEqual(firstFilter);
  });
});
