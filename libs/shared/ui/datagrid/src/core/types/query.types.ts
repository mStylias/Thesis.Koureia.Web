/**
 * Data source contract.
 *
 * The grid translates all user interaction into one declarative query
 * descriptor and hands it to the data source. It assumes no query language.
 *
 * The descriptor is a **superset** of `@ui/data-source`'s `LoadRequest`, and
 * the relation is declared rather than left to structural chance: `Query`,
 * `QueryResult` and `GridDataSource` extend their shared counterparts, so a
 * source written for any other data-bound control drives a grid, and a grid
 * source satisfies the shared contract. `core/types/contract.spec.ts` holds
 * that to it.
 */
import type {
  DataSource,
  DistinctRequest,
  DistinctResult,
  LoadRequest,
  LoadResult,
  RemoteOperations,
} from '@ui/data-source';

export type { DistinctInterval, DistinctValue, SortSpec } from '@ui/data-source';

/** One grouping criterion. Order in the array is nesting depth. */
export interface GroupSpec {
  field: string;
  desc?: boolean;
  /** Ask the source to return all group contents expanded. */
  expandAll?: boolean;
}

/** Built-in aggregate functions. `'custom'` requires {@link AggregateSpec.custom}. */
export type AggregateType = 'count' | 'sum' | 'min' | 'max' | 'avg' | 'custom';

/** One aggregate the query requests. */
export interface AggregateSpec {
  field: string;
  type: AggregateType;
  /** Identifier of a custom aggregate the data source understands. */
  custom?: string;
}

/**
 * The declarative query descriptor. All facets are optional; an absent facet
 * means "not requested".
 *
 * Everything a list control also asks for is inherited from `LoadRequest`.
 * What a grid adds is grouping and aggregation.
 */
export interface Query extends LoadRequest {
  group?: readonly GroupSpec[];
  aggregates?: readonly AggregateSpec[];
}

/**
 * One level of a hierarchical (grouped) result. `items` holds rows at the
 * deepest level and nested groups above it.
 */
export interface GroupResult<TRow> {
  key: unknown;
  items?: readonly TRow[] | readonly GroupResult<TRow>[];
  /** Total row count inside the group, present when contents are paged. */
  count?: number;
  aggregates?: Readonly<Record<string, unknown>>;
}

/**
 * What a data source returns for one query.
 *
 * `rows` and `totalCount` are inherited, and so is `hasMore`, which the grid
 * does not read: it pages by offset and asks for a count.
 */
export interface QueryResult<TRow> extends LoadResult<TRow> {
  /** Total top-level groups when the query grouped. */
  groupCount?: number;
  /** Hierarchical results when the query grouped and the source groups remotely. */
  groups?: readonly GroupResult<TRow>[];
  /** Aggregate values keyed as `<field>:<type>` (or the custom identifier). */
  aggregates?: Readonly<Record<string, unknown>>;
}

/**
 * One request for the value domain of a column.
 *
 * The grid's name for the shared `DistinctRequest`. Its `filter` is applied
 * **before** grouping and must never become a sibling post-group filter, and
 * the grid requests one extra entry to detect another page.
 */
export type DistinctValuesRequest = DistinctRequest;

/** The source response for one distinct-values request. */
export type DistinctValuesResult = DistinctResult;

/**
 * A remote (or otherwise host-controlled) data source.
 *
 * A `DataSource<TRow>` written for any other data-bound control is one of
 * these, and so is the reverse — `load` narrows its argument to `Query` and
 * its result to `QueryResult`, both of which extend what the shared contract
 * requires. `byKeys` and `loadChildren` are inherited and currently unread by
 * the grid.
 */
export interface GridDataSource<TRow> extends DataSource<TRow> {
  load(query: Query): Promise<QueryResult<TRow>>;
  /** Optional dataset-wide value-domain query used by header filters. */
  loadDistinct?(request: DistinctValuesRequest): Promise<DistinctValuesResult>;
}

/**
 * Per-operation matrix for hybrid mode: `true` means the source performs the
 * operation, `false` means the grid runs it locally on the returned rows.
 */
export type { RemoteOperations };

/** What the host supplies as data: an in-memory array or a data source. */
export type DataInput<TRow> = readonly TRow[] | GridDataSource<TRow>;

/** A load failure, reported as data. The grid never throws into the host. */
export interface GridLoadError {
  message: string;
  /** The original thrown value. */
  cause: unknown;
  /** The query that failed, without its abort signal. */
  query: Query;
}

/**
 * Data behavior: the source plus the interception hooks. Grid features
 * operate on the transformed result, so derived fields are first-class.
 */
export interface DataConfig<TRow> {
  source: DataInput<TRow>;
  /**
   * Which operations the source performs. `true` means all, `false` means
   * none (the grid post-processes locally). Ignored for array sources, which
   * are always fully local. Default for a {@link GridDataSource}: all remote.
   */
  remote?: boolean | RemoteOperations;
  /** Transform the outgoing query (inject scope filters, tenant context). */
  transformQuery?: (query: Query) => Query;
  /** Transform the incoming result (normalize, derive fields, enrich rows). */
  transformResult?: (result: QueryResult<TRow>, query: Query) => QueryResult<TRow>;
  /** Observe load failures (for logging or re-authentication flows). */
  onLoadError?: (error: GridLoadError) => void;
  /**
   * Disable re-querying when the visible column set changes, for sources
   * that ignore projection.
   */
  reloadOnProjectionChange?: boolean;
}
