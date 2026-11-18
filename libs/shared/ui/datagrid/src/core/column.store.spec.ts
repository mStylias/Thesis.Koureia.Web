import { columnField, ColumnStore } from './column.store';
import type { ColumnDef } from './types/column.types';
import type { GridColumnState } from './types/state.types';

interface Row {
  id: number;
  name: string;
  email: string;
}

describe('columnField', () => {
  it('returns the id when the def has no field', () => {
    expect(columnField<Row>({ id: 'x' })).toBe('x');
  });

  it('returns the field when the def declares one', () => {
    expect(columnField<Row>({ id: 'x', field: 'y' })).toBe('y');
  });
});

describe('ColumnStore.columns', () => {
  it('merges defaults: visible true, pinned false, width from the def', () => {
    const store = new ColumnStore<Row>();
    store.setColumns([
      { id: 'name', field: 'name', width: 150 },
      { id: 'email', field: 'email' },
    ]);
    const columns = store.columns();
    expect(
      columns.map((column) => [column.id, column.visible, column.pinned, column.width]),
    ).toEqual([
      ['name', true, false, 150],
      ['email', true, false, undefined],
    ]);
  });

  it('honors visibleIndex over declaration order', () => {
    const store = new ColumnStore<Row>();
    store.setColumns([
      { id: 'c', visibleIndex: 2 },
      { id: 'a', visibleIndex: 0 },
      { id: 'b', visibleIndex: 1 },
    ]);
    expect(store.columns().map((column) => column.id)).toEqual(['a', 'b', 'c']);
  });

  it('lets setVisible/setWidth/pin overrides win over the def values', () => {
    const store = new ColumnStore<Row>();
    store.setColumns([{ id: 'name', visible: true, width: 100, pinned: false }]);
    store.setVisible('name', false);
    store.setWidth('name', 250);
    store.pin('name', 'end');
    const column = store.columns()[0];
    expect(column.visible).toBe(false);
    expect(column.width).toBe(250);
    expect(column.pinned).toBe('end');
  });
});

describe('ColumnStore.visibleColumns', () => {
  it('filters out columns whose visible resolves to false', () => {
    const store = new ColumnStore<Row>();
    store.setColumns([{ id: 'a' }, { id: 'b', visible: false }, { id: 'c' }]);
    expect(store.visibleColumns().map((column) => column.id)).toEqual(['a', 'c']);
  });
});

describe('ColumnStore.move', () => {
  it('repositions a column among the visible columns, skipping a hidden column in between', () => {
    const store = new ColumnStore<Row>();
    store.setColumns([{ id: 'a' }, { id: 'b' }, { id: 'c' }, { id: 'd' }]);
    store.setVisible('b', false);
    // Visible order before the move is [a, c, d]; requesting visibleIndex 1 must land
    // 'd' between 'a' and 'c' among the VISIBLE columns, independent of hidden 'b'.
    store.move('d', 1);
    expect(store.columns().map((column) => column.id)).toEqual(['a', 'b', 'd', 'c']);
    expect(store.visibleColumns().map((column) => column.id)).toEqual(['a', 'd', 'c']);
  });

  it('clamps an out-of-range visibleIndex to the end', () => {
    const store = new ColumnStore<Row>();
    store.setColumns([{ id: 'a' }, { id: 'b' }, { id: 'c' }]);
    store.move('a', 100);
    expect(store.columns().map((column) => column.id)).toEqual(['b', 'c', 'a']);
  });
});

describe('ColumnStore.setColumns', () => {
  it('keeps the user order for surviving columns and appends new ones', () => {
    const store = new ColumnStore<Row>();
    store.setColumns([{ id: 'a' }, { id: 'b' }, { id: 'c' }]);
    store.move('c', 0); // establishes a custom order: c, a, b
    expect(store.columns().map((column) => column.id)).toEqual(['c', 'a', 'b']);

    store.setColumns([{ id: 'b' }, { id: 'd' }, { id: 'a' }]); // 'c' removed, 'd' added
    expect(store.columns().map((column) => column.id)).toEqual(['a', 'b', 'd']);
  });

  it('prunes overrides that belonged to a column that was removed', () => {
    const store = new ColumnStore<Row>();
    store.setColumns([{ id: 'a' }, { id: 'b' }, { id: 'c' }]);
    store.pin('c', 'end');
    store.setColumns([{ id: 'a' }, { id: 'b' }]); // 'c' removed, taking its pin override with it
    store.setColumns([{ id: 'a' }, { id: 'b' }, { id: 'c' }]); // 'c' comes back fresh
    const restored = store.columns().find((column) => column.id === 'c');
    if (!restored) {
      throw new Error('column "c" not found');
    }
    expect(restored.pinned).toBe(false);
  });
});

describe('ColumnStore.projection', () => {
  it('unions key fields, column fields, string display, and requires.select/expand, deduplicated', () => {
    const store = new ColumnStore<Row>();
    store.setKeyFields(['id']);
    store.setColumns([
      { id: 'name', field: 'name' },
      { id: 'displayCol', display: 'fullName' },
      { id: 'computedCol', display: (row: Row) => row.name },
      { id: 'extra', requires: { select: ['email', 'name'], expand: ['profile', 'profile'] } },
      { id: 'hidden', field: 'secret', visible: false },
    ]);
    const projection = store.projection();
    expect(projection.select).toEqual(['id', 'name', 'fullName', 'email']);
    expect(projection.expand).toEqual(['profile']);
  });
});

describe('ColumnStore.layoutState', () => {
  it('lists entries in display order, assigning a consecutive visibleIndex only to visible entries', () => {
    const store = new ColumnStore<Row>();
    store.setColumns([
      { id: 'a' },
      { id: 'b', visible: false },
      { id: 'c' },
      { id: 'd', width: 120, pinned: 'start' },
    ]);
    expect(store.layoutState()).toEqual([
      { id: 'a', visible: true, visibleIndex: 0, pinned: false },
      { id: 'b', visible: false, pinned: false },
      { id: 'c', visible: true, visibleIndex: 1, pinned: false },
      { id: 'd', visible: true, visibleIndex: 2, width: 120, pinned: 'start' },
    ]);
  });
});

describe('ColumnStore.applyLayoutState', () => {
  it('applies visible, width, pinned and order from the entries', () => {
    const store = new ColumnStore<Row>();
    store.setColumns([{ id: 'a' }, { id: 'b' }, { id: 'c' }]);
    const entries: GridColumnState[] = [
      { id: 'a', visible: false, width: 90, pinned: 'end', visibleIndex: 1 },
      { id: 'b', visibleIndex: 2 },
      { id: 'c', visibleIndex: 0 },
    ];
    store.applyLayoutState(entries);
    expect(store.columns().map((column) => column.id)).toEqual(['c', 'a', 'b']);
    const applied = store.columns().find((column) => column.id === 'a');
    if (!applied) {
      throw new Error('column "a" not found');
    }
    expect(applied.visible).toBe(false);
    expect(applied.width).toBe(90);
    expect(applied.pinned).toBe('end');
  });

  it('reports unknown column ids and still applies the known entries', () => {
    const store = new ColumnStore<Row>();
    store.setColumns([{ id: 'a' }, { id: 'b' }]);
    const dropped = store.applyLayoutState([
      { id: 'a', visible: false },
      { id: 'zzz', visible: true },
    ]);
    expect(dropped).toEqual(['zzz']);
    const applied = store.columns().find((column) => column.id === 'a');
    if (!applied) {
      throw new Error('column "a" not found');
    }
    expect(applied.visible).toBe(false);
  });

  it('round-trips: layoutState -> a fresh store with the same defs -> applyLayoutState -> layoutState', () => {
    const defs: ColumnDef<Row>[] = [{ id: 'a' }, { id: 'b' }, { id: 'c' }, { id: 'd' }];
    const source = new ColumnStore<Row>();
    source.setColumns(defs);
    source.setVisible('b', false);
    source.setWidth('d', 200);
    source.pin('a', 'start');
    source.move('d', 0);
    const state = source.layoutState();

    const target = new ColumnStore<Row>();
    target.setColumns(defs);
    const dropped = target.applyLayoutState(state);

    expect(dropped).toEqual([]);
    expect(target.layoutState()).toEqual(state);
  });
});
