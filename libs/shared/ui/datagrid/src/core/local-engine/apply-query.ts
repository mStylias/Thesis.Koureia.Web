/**
 * Local query engine: runs a query descriptor over in-memory rows.
 *
 * The steps are `@ui/data-source`'s and are shared with every other
 * data-bound control. What stays here is the order they run in, which only a
 * grid knows: aggregates are computed over the filtered set **before** paging
 * narrows it, and grouping prepends to the sort so rows arrive in group order.
 *
 * Grouping is not synthesized here — a grouped query sorts by the group
 * fields. Group row synthesis is the grouped body's.
 */
import { filterRows, pageRows, searchRows, sortRows } from '@ui/data-source';
import { computeAggregates } from './aggregate';
import type { Query, QueryResult, SortSpec } from '../types/query.types';
import type { LocalEngineOptions } from './apply-query.types';

/** Executes the query over the rows and returns a result. Pure. */
export function applyQueryLocally<TRow>(
  rows: readonly TRow[],
  query: Query,
  options?: LocalEngineOptions<TRow>,
): QueryResult<TRow> {
  let working = filterRows(rows, query.filter, options);
  working = searchRows(working, query.search, options);

  const totalCount = query.requireTotalCount === true ? working.length : undefined;
  const aggregates =
    query.aggregates != null && query.aggregates.length > 0
      ? computeAggregates(working, query.aggregates, {
          getValue: options?.getValue,
          customAggregates: options?.customAggregates,
        })
      : undefined;

  const sort: SortSpec[] = [
    ...(query.group ?? []).map((spec) => ({ field: spec.field, desc: spec.desc })),
    ...(query.sort ?? []),
  ];
  if (sort.length > 0) {
    working = sortRows(working, sort, options?.sortResolver);
  }
  working = pageRows(working, query.skip, query.take);

  const result: QueryResult<TRow> = { rows: working };
  if (totalCount != null) {
    return aggregates ? { ...result, totalCount, aggregates } : { ...result, totalCount };
  }
  return aggregates ? { ...result, aggregates } : result;
}

/**
 * Wraps in-memory rows in the data source contract. Pass a function for
 * `options` when the hooks change over the grid's life — column comparators
 * move with the column set, and a value captured here would go stale.
 */
export function createLocalDataSource<TRow>(
  rows: () => readonly TRow[],
  options?: LocalEngineOptions<TRow> | (() => LocalEngineOptions<TRow> | undefined),
): { load(query: Query): Promise<QueryResult<TRow>> } {
  const resolve =
    typeof options === 'function' ? options : (): LocalEngineOptions<TRow> | undefined => options;
  return {
    load: (query) => Promise.resolve(applyQueryLocally(rows(), query, resolve())),
  };
}
