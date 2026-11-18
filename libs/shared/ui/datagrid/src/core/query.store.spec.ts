import { QueryStore } from './query.store';
import { where } from './filter/filter-node';
import type { FilterGroupNode } from './types/filter.types';

describe('QueryStore', () => {
  it('produces an empty descriptor with only the total count request by default', () => {
    const store = new QueryStore();
    expect(store.query()).toEqual({ requireTotalCount: true });
  });

  it('derives skip and take from the page facets', () => {
    const store = new QueryStore({ pageSize: 25 });
    expect(store.query()).toMatchObject({ skip: 0, take: 25 });
    store.setPageIndex(3);
    expect(store.query()).toMatchObject({ skip: 75, take: 25 });
  });

  it('omits paging when the page size is null', () => {
    const store = new QueryStore();
    expect(store.query().skip).toBeUndefined();
    expect(store.query().take).toBeUndefined();
  });

  it('resets the page index when a facet that changes the result set changes', () => {
    const store = new QueryStore({ pageSize: 10 });
    store.setPageIndex(4);
    store.setSort([{ field: 'name' }]);
    expect(store.pageIndex()).toBe(0);
    store.setPageIndex(4);
    store.setFilter(where('a', 'eq', 1));
    expect(store.pageIndex()).toBe(0);
    store.setPageIndex(4);
    store.setSearch('x');
    expect(store.pageIndex()).toBe(0);
  });

  it('ignores a facet write with structurally identical content', () => {
    const store = new QueryStore({ pageSize: 10 });
    store.setSort([{ field: 'name', desc: true }]);
    store.setPageIndex(2);
    store.setSort([{ field: 'name', desc: true }]);
    expect(store.pageIndex()).toBe(2);
    const before = store.query();
    store.setFilter(null);
    expect(store.query()).toBe(before);
  });

  it('combines the base filter, column filters and the free tree with and', () => {
    const store = new QueryStore();
    store.setBaseFilter(where('tenant', 'eq', 't1'));
    store.setColumnFilter('name', where('name', 'contains', 'an'));
    store.setFilter(where('age', 'gt', 18));
    const filter = store.query().filter as FilterGroupNode;
    expect(filter.op).toBe('and');
    expect(filter.nodes).toEqual([
      { field: 'tenant', op: 'eq', value: 't1' },
      { field: 'name', op: 'contains', value: 'an' },
      { field: 'age', op: 'gt', value: 18 },
    ]);
  });

  it('unwraps a single remaining filter node', () => {
    const store = new QueryStore();
    store.setFilter(where('age', 'gt', 18));
    expect(store.query().filter).toEqual({ field: 'age', op: 'gt', value: 18 });
  });

  it('removes a column filter when set to null', () => {
    const store = new QueryStore();
    store.setColumnFilter('name', where('name', 'contains', 'an'));
    store.setColumnFilter('name', null);
    expect(store.query().filter).toBeUndefined();
  });

  it('normalizes an empty search to null', () => {
    const store = new QueryStore();
    store.setSearch('term');
    expect(store.query().search).toBe('term');
    store.setSearch('');
    expect(store.query().search).toBeUndefined();
    expect(store.search()).toBeNull();
  });

  it('clears user filters and search but keeps the base filter', () => {
    const store = new QueryStore();
    store.setBaseFilter(where('tenant', 'eq', 't1'));
    store.setFilter(where('age', 'gt', 18));
    store.setColumnFilter('name', where('name', 'contains', 'an'));
    store.setRelativeDateFilter('created', {
      field: 'createdAt',
      filter: { direction: 'last', amount: 7, unit: 'day' },
    });
    store.setSearch('x');
    store.clearFilters();
    expect(store.query().filter).toEqual({ field: 'tenant', op: 'eq', value: 't1' });
    expect(store.query().search).toBeUndefined();
    expect(store.relativeDateFilters().size).toBe(0);
  });

  it('keeps relative date filters out of the descriptor and materializes them in the effective query', () => {
    const store = new QueryStore();
    store.setRelativeDateFilter('created', {
      field: 'createdAt',
      filter: { direction: 'last', amount: 2, unit: 'hour' },
    });
    expect(store.query().filter).toBeUndefined();

    const now = new Date('2026-08-15T12:00:00.000Z');
    const effective = store.effectiveQuery(now);
    expect(effective.filter).toEqual({
      field: 'createdAt',
      op: 'between',
      value: [new Date('2026-08-15T10:00:00.000Z'), now],
    });
  });

  it('materializes relative filters against the instant of each call', () => {
    const store = new QueryStore();
    store.setRelativeDateFilter('created', {
      field: 'createdAt',
      filter: { direction: 'last', amount: 1, unit: 'day' },
    });
    const first = store.effectiveQuery(new Date('2026-08-15T12:00:00.000Z'));
    const second = store.effectiveQuery(new Date('2026-08-16T12:00:00.000Z'));
    expect(first.filter).not.toEqual(second.filter);
  });

  it('treats an identical relative filter write as a no-op', () => {
    const store = new QueryStore({ pageSize: 10 });
    store.setRelativeDateFilter('created', {
      field: 'createdAt',
      filter: { direction: 'last', amount: 7, unit: 'day' },
    });
    store.setPageIndex(3);
    store.setRelativeDateFilter('created', {
      field: 'createdAt',
      filter: { direction: 'last', amount: 7, unit: 'day' },
    });
    expect(store.pageIndex()).toBe(3);
  });

  it('exposes the projection as select and expand', () => {
    const store = new QueryStore();
    store.setProjection(['id', 'name'], ['owner']);
    expect(store.query()).toMatchObject({ select: ['id', 'name'], expand: ['owner'] });
    store.setProjection(null, null);
    expect(store.query().select).toBeUndefined();
    expect(store.query().expand).toBeUndefined();
  });

  it('increments the reload tick on reload', () => {
    const store = new QueryStore();
    expect(store.reloadTick()).toBe(0);
    store.reload();
    store.reload();
    expect(store.reloadTick()).toBe(2);
  });

  it('returns every facet to its initial value on reset', () => {
    const initialSort = [{ field: 'name' }];
    const store = new QueryStore({ sort: initialSort, pageSize: 20 });
    store.setSort([{ field: 'age', desc: true }]);
    store.setFilter(where('age', 'gt', 18));
    store.setColumnFilter('name', where('name', 'contains', 'an'));
    store.setSearch('x');
    store.setPageSize(50);
    store.setPageIndex(2);
    store.reset();
    expect(store.query()).toEqual({
      sort: initialSort,
      skip: 0,
      take: 20,
      requireTotalCount: true,
    });
  });
});
