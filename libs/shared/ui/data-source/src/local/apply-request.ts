/**
 * The local engine: runs a {@link LoadRequest} over in-memory items.
 *
 * Every step is exported on its own, because a consumer with a wider request
 * composes them in its own order. The datagrid does: its aggregates are
 * computed over the filtered set, before paging narrows it, and its grouping
 * prepends to the sort. A step run in the wrong order is a wrong answer, not a
 * slow one, so the order lives with the caller that knows its own facets.
 */
import type { LoadRequest, LoadResult } from '../data-source.types';
import { compileFilterPredicate } from '../filter/compile-predicate';
import { getPath } from '../paths';
import { foldText, foldValue } from '../text';
import { sortRows, type SortResolver } from './sort';

/** Host hooks the local engine consults. All optional. */
export interface LocalEngineOptions<T = unknown> {
  /** Resolves a field to an item value. Defaults to dot-path access. */
  getValue?: (item: T, field: string) => unknown;
  /**
   * The one text an item is searched by. Wins over {@link searchFields}.
   *
   * A list control searches what it displays, which is a function of the item
   * rather than a field on it. A grid searches across columns. Both are the
   * same operation over a different notion of "the text".
   */
  searchText?: (item: T) => string;
  /** Fields the free-text search scans. Default: own keys of the first item. */
  searchFields?: readonly string[];
  /** Per-field sort overrides (sort value, comparator). */
  sortResolver?: SortResolver<T>;
}

function valueReader<T>(options?: LocalEngineOptions<T>): (item: T, field: string) => unknown {
  return options?.getValue ?? ((item: T, field: string) => getPath(item, field));
}

/** Keeps the items the filter tree matches. A `null` tree keeps everything. */
export function filterRows<T>(
  rows: readonly T[],
  filter: LoadRequest['filter'],
  options?: LocalEngineOptions<T>,
): readonly T[] {
  if (filter == null) {
    return rows;
  }
  const predicate = compileFilterPredicate<T>(filter, { getValue: valueReader(options) });
  return rows.filter(predicate);
}

/**
 * Keeps the items whose searched fields contain the needle, folded.
 *
 * With no `searchFields` declared the scan falls back to the own keys of the
 * first item, which is right for a flat row and blind to a nested one. Declare
 * the fields whenever the shape is not flat.
 */
export function searchRows<T>(
  rows: readonly T[],
  search: string | null | undefined,
  options?: LocalEngineOptions<T>,
): readonly T[] {
  const needle = foldText(search?.trim() ?? '');
  if (needle === '') {
    return rows;
  }
  const { searchText } = options ?? {};
  if (searchText !== undefined) {
    return rows.filter((item) => foldText(searchText(item)).includes(needle));
  }
  const getValue = valueReader(options);
  const fields =
    options?.searchFields ??
    (rows.length > 0 && typeof rows[0] === 'object' && rows[0] != null ? Object.keys(rows[0]) : []);
  return rows.filter((item) =>
    fields.some((field) => foldValue(getValue(item, field))?.includes(needle) ?? false),
  );
}

/** Narrows to one window. An absent bound is open in that direction. */
export function pageRows<T>(
  rows: readonly T[],
  skip: number | undefined,
  take: number | undefined,
): readonly T[] {
  if (skip == null && take == null) {
    return rows;
  }
  const start = skip ?? 0;
  return rows.slice(start, take == null ? undefined : start + take);
}

/**
 * Runs a whole request over the items: filter, search, sort, then page.
 *
 * `totalCount` is the size after filtering and searching and before paging,
 * and it is reported only when the request asked for it. `hasMore` is always
 * reported, because a list control pages by it and cannot ask for a count it
 * would then have to trust.
 */
export function applyLoadRequest<T>(
  rows: readonly T[],
  request: LoadRequest,
  options?: LocalEngineOptions<T>,
): LoadResult<T> {
  const source = rows;
  let working = filterRows(source, request.filter, options);
  working = searchRows(working, request.search, options);

  const matched = working.length;
  if (request.sort != null && request.sort.length > 0) {
    working = sortRows(working, request.sort, options?.sortResolver);
  }
  const skip = request.skip ?? 0;
  const page = pageRows(working, request.skip, request.take);

  return {
    rows: page,
    ...(request.requireTotalCount === true ? { totalCount: matched } : {}),
    hasMore: skip + page.length < matched,
  };
}
