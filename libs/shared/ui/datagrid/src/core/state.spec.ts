import { ApplicationRef, Injector } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ColumnStore } from './column.store';
import { DataStore, connectDataStore } from './data.store';
import { QueryStore } from './query.store';
import {
  GRID_STATE_VERSION,
  applyGridState,
  gridStatesEqual,
  gridViewStatesEqual,
  serializeGridState,
} from './state';
import { where } from './filter/filter-node';
import type { ColumnDef } from './types/column.types';
import type { GridDataSource, Query, QueryResult } from './types/query.types';
import type { GridState } from './types/state.types';

interface Row {
  id: number;
  name: string;
  age: number;
  createdAt: string;
}

const DEFS: ColumnDef<Row>[] = [
  { id: 'name', field: 'name' },
  { id: 'age', field: 'age', dataType: 'number' },
  { id: 'created', field: 'createdAt', dataType: 'datetime' },
];

function makeStores(): { columns: ColumnStore<Row>; query: QueryStore } {
  const columns = new ColumnStore<Row>();
  columns.setColumns(DEFS);
  const query = new QueryStore({ pageSize: 25 });
  return { columns, query };
}

function arrangeEverything(stores: { columns: ColumnStore<Row>; query: QueryStore }): void {
  stores.columns.setVisible('created', false);
  stores.columns.setWidth('name', 220);
  stores.columns.pin('name', 'start');
  stores.columns.move('age', 0);
  stores.query.setSort([{ field: 'age', desc: true }, { field: 'name' }]);
  stores.query.setColumnFilter('name', where('name', 'contains', 'an'));
  stores.query.setRelativeDateFilter('created', {
    field: 'createdAt',
    filter: { direction: 'last', amount: 7, unit: 'day' },
  });
  stores.query.setFilter(where('age', 'gt', 18));
  stores.query.setSearch('term');
  stores.query.setPageSize(50);
  stores.query.setGroup([{ field: 'name' }]);
}

describe('serializeGridState', () => {
  it('captures every user-arrangeable facet and excludes volatile values', () => {
    const stores = makeStores();
    arrangeEverything(stores);
    stores.query.setPageIndex(3);
    const state = serializeGridState(stores);

    expect(state.version).toBe(GRID_STATE_VERSION);
    expect(state.filter).toEqual({ field: 'age', op: 'gt', value: 18 });
    expect(state.search).toBe('term');
    expect(state.pageSize).toBe(50);
    expect(state.grouping).toEqual([{ field: 'name' }]);
    expect(state).not.toHaveProperty('pageIndex');

    const byId = new Map(state.columns.map((entry) => [entry.id, entry]));
    expect(byId.get('age')?.sort).toEqual({ order: 'desc', index: 0 });
    expect(byId.get('name')?.sort).toEqual({ order: 'asc', index: 1 });
    expect(byId.get('name')?.filter).toEqual({ field: 'name', op: 'contains', value: 'an' });
    expect(byId.get('name')?.width).toBe(220);
    expect(byId.get('name')?.pinned).toBe('start');
    expect(byId.get('created')?.visible).toBe(false);
    expect(byId.get('created')?.relativeDateFilter).toEqual({
      direction: 'last',
      amount: 7,
      unit: 'day',
    });
    expect(byId.get('age')?.visibleIndex).toBe(0);
  });

  it('is JSON round-trippable', () => {
    const stores = makeStores();
    arrangeEverything(stores);
    const state = serializeGridState(stores);
    const revived = JSON.parse(JSON.stringify(state)) as GridState;
    expect(gridStatesEqual(state, revived)).toBe(true);
  });
});

describe('applyGridState', () => {
  it('round-trips: applying a serialized state to fresh stores reproduces it', () => {
    const stores = makeStores();
    arrangeEverything(stores);
    const state = serializeGridState(stores);

    const fresh = makeStores();
    const report = applyGridState(fresh, state);
    expect(report.applied).toBe(true);
    expect(report.droppedColumnIds).toEqual([]);

    expect(gridStatesEqual(serializeGridState(fresh), state)).toBe(true);
    expect(fresh.query.query()).toEqual(stores.query.query());
    expect(fresh.query.effectiveQuery(new Date('2026-08-15T12:00:00Z'))).toEqual(
      stores.query.effectiveQuery(new Date('2026-08-15T12:00:00Z')),
    );
  });

  it('ignores and reports entries for columns that no longer exist', () => {
    const stores = makeStores();
    const state = serializeGridState(stores);
    state.columns.push({
      id: 'ghost',
      visible: true,
      visibleIndex: 0,
      sort: { order: 'asc', index: 0 },
    });
    const report = applyGridState(stores, state);
    expect(report.applied).toBe(true);
    expect(report.droppedColumnIds).toEqual(['ghost']);
    expect(stores.query.sort()).toEqual([]);
    expect(stores.columns.columns().map((column) => column.id)).toEqual(['name', 'age', 'created']);
  });

  it('refuses a state from another version when no migration is given', () => {
    const stores = makeStores();
    const state = serializeGridState(stores);
    const foreign: GridState = { ...state, version: GRID_STATE_VERSION + 1, search: 'x' };
    const report = applyGridState(stores, foreign);
    expect(report.applied).toBe(false);
    expect(stores.query.search()).toBeNull();
  });

  it('routes a state from another version through the migration hook', () => {
    const stores = makeStores();
    const state = serializeGridState(stores);
    const foreign: GridState = { ...state, version: GRID_STATE_VERSION + 1, search: 'legacy' };
    const report = applyGridState(stores, foreign, {
      migrate: (old) => ({ ...old, version: GRID_STATE_VERSION }),
    });
    expect(report.applied).toBe(true);
    expect(stores.query.search()).toBe('legacy');
  });

  it('derives grouping from per-column group entries when the top-level list is absent', () => {
    const stores = makeStores();
    const state: GridState = {
      version: GRID_STATE_VERSION,
      columns: [
        { id: 'age', group: { index: 1 } },
        { id: 'name', group: { index: 0 } },
      ],
    };
    applyGridState(stores, state);
    expect(stores.query.group()).toEqual([{ field: 'name' }, { field: 'age' }]);
  });

  it('issues exactly one data query for a full state application', async () => {
    const queries: Query[] = [];
    const source: GridDataSource<Row> = {
      load: (query) => {
        queries.push(query);
        return Promise.resolve<QueryResult<Row>>({ rows: [] });
      },
    };
    const stores = makeStores();
    arrangeEverything(stores);
    const state = serializeGridState(stores);

    const fresh = makeStores();
    const dataStore = new DataStore<Row>(source);
    connectDataStore(fresh.query, dataStore, TestBed.inject(Injector));
    const flush = async (): Promise<void> => {
      TestBed.inject(ApplicationRef).tick();
      await new Promise((resolve) => {
        setTimeout(resolve, 0);
      });
    };
    await flush();
    expect(queries).toHaveLength(1);

    applyGridState(fresh, state);
    await flush();
    expect(queries).toHaveLength(2);
  });
});

describe('gridStatesEqual', () => {
  it('is insensitive to column array order and absent-vs-undefined properties', () => {
    const stores = makeStores();
    arrangeEverything(stores);
    const state = serializeGridState(stores);
    const shuffled: GridState = {
      ...state,
      columns: [...state.columns].reverse(),
      grouping: state.grouping?.map((spec) => ({ field: spec.field, desc: undefined })),
    };
    expect(gridStatesEqual(state, shuffled)).toBe(true);
  });

  // A host that builds a view writes `filter: null` for "no filter". The grid omits the member.
  it('reads a null member as absent, since apply does', () => {
    const state = serializeGridState(makeStores());
    const built: GridState = {
      ...state,
      filter: null,
      search: null,
      columns: state.columns.map((entry) => ({ ...entry, filter: null, headerFilter: null })),
    };
    expect(gridStatesEqual(state, built)).toBe(true);
  });

  it('keeps a null inside a filter node, which is a value', () => {
    const state = serializeGridState(makeStores());
    const withValue: GridState = { ...state, filter: { field: 'name', op: 'eq', value: null } };
    const withOther: GridState = { ...state, filter: { field: 'name', op: 'eq', value: 'x' } };
    expect(gridStatesEqual(withValue, withOther)).toBe(false);
  });

  it('detects a real difference', () => {
    const stores = makeStores();
    arrangeEverything(stores);
    const state = serializeGridState(stores);
    const changed: GridState = {
      ...state,
      columns: state.columns.map((entry) =>
        entry.id === 'name' ? { ...entry, width: 300 } : entry,
      ),
    };
    expect(gridStatesEqual(state, changed)).toBe(false);
  });
});

describe('gridViewStatesEqual', () => {
  /** A view saved while the grid had only `name` and `age`, sorted by age. */
  function savedBeforeCreated(): GridState {
    const stores = makeStores();
    stores.columns.setColumns(DEFS.filter((def) => def.id !== 'created'));
    stores.query.setSort([{ field: 'age' }]);
    return serializeGridState(stores);
  }

  function appliedNow(saved: GridState): { columns: ColumnStore<Row>; query: QueryStore } {
    const stores = makeStores();
    applyGridState(stores, saved);
    return stores;
  }

  it('equals gridStatesEqual when both states name every column', () => {
    const stores = makeStores();
    arrangeEverything(stores);
    const state = serializeGridState(stores);
    expect(gridViewStatesEqual(state, state)).toBe(true);
    const changed: GridState = { ...state, search: 'other' };
    expect(gridViewStatesEqual(changed, state)).toBe(false);
  });

  it('ignores the layout of a column added after the view was saved', () => {
    const saved = savedBeforeCreated();
    const stores = appliedNow(saved);
    expect(gridStatesEqual(serializeGridState(stores), saved)).toBe(false);
    expect(gridViewStatesEqual(serializeGridState(stores), saved)).toBe(true);

    stores.columns.move('created', 0);
    stores.columns.setWidth('created', 90);
    expect(gridViewStatesEqual(serializeGridState(stores), saved)).toBe(true);
  });

  it('counts a sort or a filter on that column, which applying the view clears', () => {
    const saved = savedBeforeCreated();
    const stores = appliedNow(saved);
    stores.query.setRelativeDateFilter('created', {
      field: 'createdAt',
      filter: { direction: 'last', amount: 7, unit: 'day' },
    });
    expect(gridViewStatesEqual(serializeGridState(stores), saved)).toBe(false);
  });

  it('ignores a column the grid no longer has', () => {
    const stores = makeStores();
    const saved: GridState = {
      ...serializeGridState(stores),
      columns: [
        { id: 'gone', visible: true, visibleIndex: 0, sort: { order: 'asc', index: 0 } },
        ...serializeGridState(stores).columns.map((entry) => ({
          ...entry,
          visibleIndex: (entry.visibleIndex ?? 0) + 1,
        })),
      ],
    };
    expect(gridViewStatesEqual(serializeGridState(appliedNow(saved)), saved)).toBe(true);
  });

  it('still reports a change to a column the view names', () => {
    const saved = savedBeforeCreated();
    const stores = appliedNow(saved);
    stores.columns.move('name', 1);
    expect(gridViewStatesEqual(serializeGridState(stores), saved)).toBe(false);
  });
});
