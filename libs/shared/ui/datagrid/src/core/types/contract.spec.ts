/**
 * The grid's query contract against the shared one.
 *
 * `Query`, `QueryResult` and `GridDataSource` are declared to extend
 * `@ui/data-source`'s `LoadRequest`, `LoadResult` and `DataSource`. Before
 * they were declared they were merely structurally compatible, which the next
 * added member would have ended silently. These assertions are the reason a
 * host can hand one source to a grid and to a select.
 *
 * The assertions are types: `Assert<Extends<...>>` fails compilation, not the
 * run. The runtime cases exercise the same substitutions so the file is a real
 * spec and a deleted type argument cannot leave it vacuously green.
 */
import type {
  DataKey,
  DataSource,
  DistinctRequest,
  DistinctResult,
  LoadRequest,
  LoadResult,
} from '@ui/data-source';
import type { GridKey } from './key.types';
import type {
  DistinctValuesRequest,
  DistinctValuesResult,
  GridDataSource,
  Query,
  QueryResult,
} from './query.types';

type Assert<T extends true> = T;
type Extends<A, B> = A extends B ? true : false;

interface Row {
  id: number;
  name: string;
}

// The grid asks for everything a list control asks for, plus grouping and
// aggregation.
export type QueryIsALoadRequest = Assert<Extends<Query, LoadRequest>>;
export type QueryResultIsALoadResult = Assert<Extends<QueryResult<Row>, LoadResult<Row>>>;

// The distinct pair is the same contract under two names, in both directions.
export type DistinctRequestsAgree = Assert<Extends<DistinctValuesRequest, DistinctRequest>>;
export type DistinctRequestsAgreeBack = Assert<Extends<DistinctRequest, DistinctValuesRequest>>;
export type DistinctResultsAgree = Assert<Extends<DistinctValuesResult, DistinctResult>>;
export type DistinctResultsAgreeBack = Assert<Extends<DistinctResult, DistinctValuesResult>>;

// A grid key is a data key. The grid's name for it is the only difference.
export type GridKeyIsADataKey = Assert<Extends<GridKey, DataKey>>;
export type DataKeyIsAGridKey = Assert<Extends<DataKey, GridKey>>;

// The relation that carries the layer: either source drives either consumer.
export type GridSourceIsADataSource = Assert<Extends<GridDataSource<Row>, DataSource<Row>>>;
export type DataSourceIsAGridSource = Assert<Extends<DataSource<Row>, GridDataSource<Row>>>;

describe('the grid query contract', () => {
  const rows: readonly Row[] = [{ id: 1, name: 'one' }];

  it('accepts a grid source wherever the shared contract is required', async () => {
    const gridSource: GridDataSource<Row> = {
      load: (query: Query) =>
        Promise.resolve({ rows: rows.slice(query.skip ?? 0), totalCount: rows.length }),
    };
    const shared: DataSource<Row> = gridSource;

    await expect(shared.load({ skip: 0, take: 10 })).resolves.toEqual({
      rows,
      totalCount: 1,
    });
  });

  it('accepts a shared source wherever the grid requires one', async () => {
    const shared: DataSource<Row> = {
      load: (request: LoadRequest) =>
        Promise.resolve({ rows: rows.slice(request.skip ?? 0), hasMore: false }),
    };
    const gridSource: GridDataSource<Row> = shared;

    // `hasMore` rides along from `LoadResult`. The grid ignores it; it must not
    // fail to type.
    const result: QueryResult<Row> = await gridSource.load({ take: 10, group: [] });
    expect(result.rows).toEqual(rows);
    expect(result.hasMore).toBe(false);
  });

  it('passes a grid distinct request to a shared distinct method', async () => {
    const shared: DataSource<Row> = {
      load: () => Promise.resolve({ rows: [] }),
      loadDistinct: (request: DistinctRequest) =>
        Promise.resolve({ values: [{ value: request.field }] }),
    };
    // Presence is the capability, so a consumer reads the method before it
    // calls it. This is that read, in the one direction the grid needs.
    if (shared.loadDistinct === undefined) {
      throw new Error('the fake source declares loadDistinct');
    }
    const request: DistinctValuesRequest = { field: 'name', take: 11 };
    const result: DistinctValuesResult = await shared.loadDistinct(request);

    expect(result.values).toEqual([{ value: 'name' }]);
  });
});
