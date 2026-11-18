import type {
  DistinctValue,
  GridDataSource,
  GridLoadError,
  Query,
  QueryResult,
  RemoteOperations,
} from './types/query.types';

export interface NormalizedData<TRow> {
  source: GridDataSource<TRow>;
  /** Retained so distinct values use the whole array, not the loaded page. */
  array: readonly TRow[] | null;
  remote: Required<RemoteOperations>;
  transformQuery?: (query: Query) => Query;
  transformResult?: (result: QueryResult<TRow>, query: Query) => QueryResult<TRow>;
  onLoadError?: (error: GridLoadError) => void;
}

/**
 * How a result meets the rows already loaded. `'accumulate'` is infinite
 * scrolling: a query that only moves the window further down the same result
 * set extends the rows instead of replacing them.
 */
export type DataAccumulation = 'replace' | 'accumulate';

/** How the grid resolved one header-filter value page. */
export interface DistinctLoadResult {
  values: readonly DistinctValue[];
  /** Representative rows aligned with local values, for display mappings. */
  representativeRows?: readonly unknown[];
  hasMore?: boolean;
  /** True when only the rows already loaded by the grid were available. */
  partial: boolean;
  origin: 'source' | 'array' | 'loaded';
}

/** Minimum and maximum raw values of one source field. */
export interface ValueBounds {
  min: unknown;
  max: unknown;
}
