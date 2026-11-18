import type { DataSource, LoadRequest, LoadResult } from '../data-source.types';
import {
  normalizeRemote,
  remoteMatrixWarning,
  splitRequest,
  withLocalOperations,
} from './remote-operations';

interface Row {
  id: number;
  city: string;
}

/** A grid-shaped request: everything a LoadRequest has, plus two more facets. */
interface GridQuery extends LoadRequest {
  group?: readonly { field: string }[];
  aggregates?: readonly { field: string; type: string }[];
}

const ROWS: readonly Row[] = [
  { id: 1, city: 'Αθήνα' },
  { id: 2, city: 'Θεσσαλονίκη' },
  { id: 3, city: 'Αθήνα' },
];

describe('normalizeRemote', () => {
  it('reads true, false and a partial matrix', () => {
    expect(normalizeRemote(true).sorting).toBe(true);
    expect(normalizeRemote(undefined).sorting).toBe(true);
    expect(normalizeRemote(false).sorting).toBe(false);

    const mixed = normalizeRemote({ filtering: true });
    expect(mixed.filtering).toBe(true);
    // An unlisted operation is local, not remote: the object form names what
    // the endpoint can do, so silence means it cannot.
    expect(mixed.sorting).toBe(false);
  });
});

describe('splitRequest', () => {
  it('sends everything when the matrix is all remote', () => {
    const request: LoadRequest = { filter: { field: 'city', op: 'eq', value: 'Αθήνα' }, take: 2 };
    const { outgoing, local } = splitRequest(request, normalizeRemote(true));
    expect(outgoing).toEqual(request);
    expect(local).toEqual({});
  });

  it('holds back only the operations the matrix marks local', () => {
    const request: LoadRequest = {
      filter: { field: 'city', op: 'eq', value: 'Αθήνα' },
      sort: [{ field: 'id' }],
      take: 2,
    };
    const { outgoing, local } = splitRequest(
      request,
      normalizeRemote({ filtering: true, paging: true }),
    );
    expect(outgoing.filter).toBeDefined();
    expect(outgoing.take).toBe(2);
    expect(outgoing.sort).toBeUndefined();
    expect(local.sort).toEqual([{ field: 'id' }]);
  });

  it('moves the whole paging triple together', () => {
    const request: LoadRequest = { skip: 10, take: 5, requireTotalCount: true };
    const { outgoing, local } = splitRequest(request, normalizeRemote({ paging: false }));
    expect(outgoing.skip).toBeUndefined();
    expect(outgoing.take).toBeUndefined();
    expect(outgoing.requireTotalCount).toBeUndefined();
    expect(local).toEqual({ skip: 10, take: 5, requireTotalCount: true });
  });

  it('splits facets a wider request carries and a LoadRequest does not', () => {
    // This is why the split is generic: the datagrid's group and aggregates
    // travel through the same code every other control uses.
    const query: GridQuery = {
      group: [{ field: 'city' }],
      aggregates: [{ field: 'id', type: 'count' }],
      sort: [{ field: 'id' }],
    };
    const { outgoing, local } = splitRequest(
      query,
      normalizeRemote({ sorting: true, grouping: false, aggregation: false }),
    );
    expect(outgoing.sort).toEqual([{ field: 'id' }]);
    expect(outgoing.group).toBeUndefined();
    expect(outgoing.aggregates).toBeUndefined();
    expect(local.group).toEqual([{ field: 'city' }]);
    expect(local.aggregates).toEqual([{ field: 'id', type: 'count' }]);
  });

  it('does not copy the original request object', () => {
    const request: LoadRequest = { sort: [{ field: 'id' }] };
    splitRequest(request, normalizeRemote(false));
    expect(request.sort).toEqual([{ field: 'id' }]);
  });
});

describe('remoteMatrixWarning', () => {
  it('says nothing about a sound matrix', () => {
    expect(remoteMatrixWarning(normalizeRemote(true))).toBeNull();
    expect(remoteMatrixWarning(normalizeRemote(false))).toBeNull();
  });

  it('names every page-local operation under remote paging', () => {
    const warning = remoteMatrixWarning(
      normalizeRemote({ paging: true, filtering: true, search: true, grouping: true }),
      'datagrid',
    );
    expect(warning).toContain('datagrid');
    expect(warning).toContain('sorting');
    expect(warning).toContain('aggregation');
    // A local sort over a remote page orders each page on its own, and the
    // layer cannot repair that without fetching everything.
    expect(warning).toContain('page-local');
  });
});

describe('withLocalOperations', () => {
  function remoteSource(calls: LoadRequest[]): DataSource<Row> {
    return {
      load: (request) => {
        calls.push(request);
        return Promise.resolve<LoadResult<Row>>({ rows: ROWS, totalCount: ROWS.length });
      },
    };
  }

  it('runs a held-back operation over what the source returned', async () => {
    const calls: LoadRequest[] = [];
    const source = withLocalOperations(remoteSource(calls), { filtering: false, paging: true });

    const result = await source.load({ filter: { field: 'city', op: 'eq', value: 'Αθήνα' } });

    expect(calls[0].filter).toBeUndefined();
    expect(result.rows.map((row) => row.id)).toEqual([1, 3]);
  });

  it('leaves the source result untouched when nothing was held back', async () => {
    const calls: LoadRequest[] = [];
    const source = withLocalOperations(remoteSource(calls), true);

    const result = await source.load({ sort: [{ field: 'id', desc: true }] });

    // The source already ordered it, and a local pass could only re-derive the
    // total worse than the source reported it.
    expect(calls[0].sort).toEqual([{ field: 'id', desc: true }]);
    expect(result.rows).toBe(ROWS);
    expect(result.totalCount).toBe(3);
  });

  it('runs every operation locally when the matrix is false', async () => {
    const calls: LoadRequest[] = [];
    const source = withLocalOperations(remoteSource(calls), false);

    const result = await source.load({
      filter: { field: 'city', op: 'eq', value: 'Αθήνα' },
      sort: [{ field: 'id', desc: true }],
      skip: 1,
      take: 1,
      requireTotalCount: true,
    });

    expect(calls[0]).toEqual({});
    expect(result.rows.map((row) => row.id)).toEqual([1]);
    expect(result.totalCount).toBe(2);
  });

  it('carries capabilities across, and only the ones the source has', async () => {
    const bare = withLocalOperations(remoteSource([]), false);
    expect(typeof bare.byKeys).toBe('undefined');
    expect(typeof bare.loadChildren).toBe('undefined');
    expect(typeof bare.loadDistinct).toBe('undefined');

    const full = withLocalOperations(
      {
        load: () => Promise.resolve({ rows: [] }),
        byKeys: () => Promise.resolve(ROWS.slice(0, 1)),
        loadChildren: () => Promise.resolve({ rows: ROWS }),
        loadDistinct: () => Promise.resolve({ values: [{ value: 'Αθήνα' }] }),
      },
      false,
    );
    expect(await full.byKeys?.([1])).toHaveLength(1);
    // Distinct is dataset-wide by definition, so there is no local half of it
    // to run over a page. It passes straight through.
    expect(await full.loadDistinct?.({ field: 'city' })).toEqual({
      values: [{ value: 'Αθήνα' }],
    });
  });

  it('runs a held-back operation over one loaded level', async () => {
    const source = withLocalOperations(
      {
        load: () => Promise.resolve({ rows: [] }),
        loadChildren: () => Promise.resolve({ rows: ROWS }),
      },
      { filtering: false },
    );

    const level = await source.loadChildren?.(null, {
      filter: { field: 'city', op: 'eq', value: 'Θεσσαλονίκη' },
    });
    expect(level?.rows.map((row) => row.id)).toEqual([2]);
  });
});
