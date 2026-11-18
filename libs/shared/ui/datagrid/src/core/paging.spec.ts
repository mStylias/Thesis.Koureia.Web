import { clampPageIndex, isPageAdvance, pageCountOf, pageInfo, shouldLoadMore } from './paging';
import type { Query } from './types/query.types';

describe('pageCountOf', () => {
  it('returns null for a null total', () => {
    expect(pageCountOf(null, 10)).toBeNull();
  });

  it('divides exactly when the total is a multiple of the page size', () => {
    expect(pageCountOf(100, 25)).toBe(4);
  });

  it('rounds a remainder up to an extra page', () => {
    expect(pageCountOf(101, 25)).toBe(5);
  });

  it('returns null for a zero page size', () => {
    expect(pageCountOf(100, 0)).toBeNull();
  });

  it('returns null for a negative page size', () => {
    expect(pageCountOf(100, -10)).toBeNull();
  });

  it('yields at least 1 page for a zero total', () => {
    expect(pageCountOf(0, 10)).toBe(1);
  });
});

describe('clampPageIndex', () => {
  it('clamps a negative index to 0', () => {
    expect(clampPageIndex(-5, 10)).toBe(0);
  });

  it('clamps an index beyond the last page to the last page', () => {
    expect(clampPageIndex(10, 5)).toBe(4);
  });

  it('leaves the index alone (other than flooring/negative clamp) when the page count is unknown', () => {
    expect(clampPageIndex(7, null)).toBe(7);
  });
});

describe('pageInfo', () => {
  it('reports 1-based firstRow and lastRow for a full page', () => {
    const info = pageInfo({ pageIndex: 2, pageSize: 10, total: 100, loadedRows: 10 });
    expect(info.firstRow).toBe(21);
    expect(info.lastRow).toBe(30);
  });

  it('reports 0 for both firstRow and lastRow when no rows are loaded', () => {
    const info = pageInfo({ pageIndex: 0, pageSize: 10, total: 0, loadedRows: 0 });
    expect(info.firstRow).toBe(0);
    expect(info.lastRow).toBe(0);
  });

  it('derives hasNext from a known total', () => {
    const middle = pageInfo({ pageIndex: 1, pageSize: 10, total: 25, loadedRows: 10 });
    expect(middle.hasNext).toBe(true);
    const last = pageInfo({ pageIndex: 2, pageSize: 10, total: 25, loadedRows: 5 });
    expect(last.hasNext).toBe(false);
  });

  it('with an unknown total, reports hasNext true only when the page came back full', () => {
    const full = pageInfo({ pageIndex: 0, pageSize: 10, total: null, loadedRows: 10 });
    expect(full.hasNext).toBe(true);
    const partial = pageInfo({ pageIndex: 0, pageSize: 10, total: null, loadedRows: 5 });
    expect(partial.hasNext).toBe(false);
  });
});

describe('isPageAdvance', () => {
  function query(overrides: Partial<Query> = {}): Query {
    return { skip: 0, take: 10, ...overrides };
  }

  it('returns false when there is no previous query', () => {
    expect(isPageAdvance(null, query())).toBe(false);
  });

  it('returns false when the skip is unchanged', () => {
    expect(isPageAdvance(query({ skip: 20 }), query({ skip: 20 }))).toBe(false);
  });

  it('returns false when the skip is smaller than before', () => {
    expect(isPageAdvance(query({ skip: 20 }), query({ skip: 10 }))).toBe(false);
  });

  it('returns true for a larger skip with an identical filter and sort', () => {
    const previous = query({
      skip: 0,
      filter: { field: 'a', op: 'eq', value: 1 },
      sort: [{ field: 'a' }],
    });
    const next = query({
      skip: 10,
      filter: { field: 'a', op: 'eq', value: 1 },
      sort: [{ field: 'a' }],
    });
    expect(isPageAdvance(previous, next)).toBe(true);
  });

  it('returns false for a larger skip with a changed filter', () => {
    const previous = query({ skip: 0, filter: { field: 'a', op: 'eq', value: 1 } });
    const next = query({ skip: 10, filter: { field: 'a', op: 'eq', value: 2 } });
    expect(isPageAdvance(previous, next)).toBe(false);
  });

  it('returns false for a larger skip with a changed sort', () => {
    const previous = query({ skip: 0, sort: [{ field: 'a' }] });
    const next = query({ skip: 10, sort: [{ field: 'a', desc: true }] });
    expect(isPageAdvance(previous, next)).toBe(false);
  });

  it('treats queries differing only in take and signal as the same result set', () => {
    const previous = query({ skip: 0, take: 10, signal: new AbortController().signal });
    const next = query({ skip: 10, take: 25, signal: new AbortController().signal });
    expect(isPageAdvance(previous, next)).toBe(true);
  });
});

describe('shouldLoadMore', () => {
  it('is suppressed while loading', () => {
    const result = shouldLoadMore({
      windowEnd: 100,
      loadedRows: 50,
      total: null,
      threshold: 10,
      loading: true,
    });
    expect(result).toBe(false);
  });

  it('is suppressed once loadedRows reaches the total', () => {
    const result = shouldLoadMore({
      windowEnd: 50,
      loadedRows: 100,
      total: 100,
      threshold: 10,
      loading: false,
    });
    expect(result).toBe(false);
  });

  it('fires when windowEnd + threshold reaches loadedRows', () => {
    const result = shouldLoadMore({
      windowEnd: 90,
      loadedRows: 95,
      total: null,
      threshold: 10,
      loading: false,
    });
    expect(result).toBe(true);
  });

  it('does not fire while windowEnd + threshold is short of loadedRows', () => {
    const result = shouldLoadMore({
      windowEnd: 10,
      loadedRows: 95,
      total: null,
      threshold: 10,
      loading: false,
    });
    expect(result).toBe(false);
  });

  it('an unknown total does not suppress the check', () => {
    const result = shouldLoadMore({
      windowEnd: 990,
      loadedRows: 1000,
      total: null,
      threshold: 10,
      loading: false,
    });
    expect(result).toBe(true);
  });
});
