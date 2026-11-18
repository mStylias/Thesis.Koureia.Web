/**
 * Page arithmetic and the rule that decides when a result appends instead of
 * replacing.
 *
 * Page indices are 0-based here and 1-based in the pager UI; the conversion
 * happens at that boundary and nowhere else.
 */
import type { Query } from './types/query.types';
import type { PageInfo } from './paging.types';

/**
 * A page index as a whole number of pages from the first one.
 *
 * A model or an API caller can hand over a fraction or a `NaN`, and either one
 * turns `skip` into a value no source can answer.
 */
export function normalizePageIndex(index: number): number {
  return Number.isFinite(index) ? Math.max(0, Math.floor(index)) : 0;
}

/**
 * A page size as a whole number of rows, or `null` when the value cannot be
 * one. `null` from the caller disables paging; `null` from an unusable number
 * tells the caller to keep the size it has.
 */
export function normalizePageSize(size: number | null): number | null {
  if (size == null || !Number.isFinite(size) || size < 1) {
    return null;
  }
  return Math.floor(size);
}

export function pageCountOf(total: number | null, pageSize: number): number | null {
  if (total == null || pageSize <= 0) {
    return null;
  }
  return Math.max(1, Math.ceil(total / pageSize));
}

export function clampPageIndex(index: number, pageCount: number | null): number {
  const floored = Math.max(0, Math.floor(index));
  if (pageCount == null) {
    return floored;
  }
  return Math.min(floored, Math.max(0, pageCount - 1));
}

/** Derives the pager view model. `loadedRows` is what the current page holds. */
export function pageInfo(options: {
  pageIndex: number;
  pageSize: number;
  total: number | null;
  loadedRows: number;
}): PageInfo {
  const pageSize = Math.max(1, Math.floor(options.pageSize));
  const pageCount = pageCountOf(options.total, pageSize);
  const pageIndex = clampPageIndex(options.pageIndex, pageCount);
  const firstRow = options.loadedRows === 0 ? 0 : pageIndex * pageSize + 1;
  const lastRow = options.loadedRows === 0 ? 0 : pageIndex * pageSize + options.loadedRows;
  return {
    pageIndex,
    pageSize,
    total: options.total,
    pageCount,
    firstRow,
    lastRow,
    hasPrevious: pageIndex > 0,
    hasNext: pageCount == null ? options.loadedRows >= pageSize : pageIndex < pageCount - 1,
  };
}

/**
 * True when the next query only asks for rows further down the same result
 * set, so the rows extend what is loaded rather than replacing it.
 *
 * Derived by comparing the two queries rather than tracked as a flag: a flag
 * has to be cleared by every other mutation, and one missed reset shows the
 * user a list stitched from two different filters.
 */
export function isPageAdvance(previous: Query | null, next: Query): boolean {
  if (previous == null) {
    return false;
  }
  const previousSkip = previous.skip ?? 0;
  const nextSkip = next.skip ?? 0;
  if (nextSkip <= previousSkip) {
    return false;
  }
  return sameResultSet(previous, next);
}

/** Compares every facet that defines which rows match, ignoring the window. */
function sameResultSet(previous: Query, next: Query): boolean {
  const strip = (query: Query): string => {
    const { skip: _skip, take: _take, signal: _signal, ...rest } = query;
    void _skip;
    void _take;
    void _signal;
    return JSON.stringify(rest, replacer);
  };
  return strip(previous) === strip(next);
}

/**
 * Serializes values `JSON.stringify` drops or mangles, so two queries that
 * differ only in a function or a bigint are not read as identical.
 */
function replacer(_key: string, value: unknown): unknown {
  if (typeof value === 'bigint') {
    return `bigint:${value.toString()}`;
  }
  if (typeof value === 'function') {
    return `fn:${value.name}`;
  }
  if (value instanceof Date) {
    return `date:${value.toISOString()}`;
  }
  return value;
}

/**
 * True when the visible window has come within `threshold` rows of the last
 * loaded row, which is when infinite scrolling asks for the next page.
 */
export function shouldLoadMore(options: {
  windowEnd: number;
  loadedRows: number;
  total: number | null;
  threshold: number;
  loading: boolean;
}): boolean {
  if (options.loading) {
    return false;
  }
  if (options.total != null && options.loadedRows >= options.total) {
    return false;
  }
  return options.windowEnd + Math.max(0, options.threshold) >= options.loadedRows;
}
