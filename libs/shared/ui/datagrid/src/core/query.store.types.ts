import type { FilterNode, RelativeDateFilter } from './types/filter.types';
import type { AggregateSpec, GroupSpec, SortSpec } from './types/query.types';

/** A relative date filter owned by one column. */
export interface RelativeColumnFilter {
  /** The query field the materialized condition targets. */
  field: string;
  filter: RelativeDateFilter;
}

/** Initial facet values, captured for `reset()`. */
export interface QueryStoreInit {
  sort?: readonly SortSpec[];
  group?: readonly GroupSpec[];
  filter?: FilterNode | null;
  baseFilter?: FilterNode | null;
  search?: string | null;
  /** `null` disables paging. */
  pageSize?: number | null;
  aggregates?: readonly AggregateSpec[];
  requireTotalCount?: boolean;
}
