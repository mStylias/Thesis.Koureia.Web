import { SelectionStore } from './selection.store';
import type { FilterNode } from './types/filter.types';

describe('SelectionStore default mode "none"', () => {
  it('starts in mode "none"', () => {
    const store = new SelectionStore();
    expect(store.mode()).toBe('none');
  });

  it('setSelectedKeys is a no-op', () => {
    const store = new SelectionStore();
    store.setSelectedKeys([1, 2]);
    expect(store.selectedKeys()).toEqual([]);
  });

  it('toggle is a no-op', () => {
    const store = new SelectionStore();
    store.toggle(1);
    expect(store.selectedKeys()).toEqual([]);
    expect(store.isSelected(1)).toBe(false);
  });

  it('selectAllMatching is a no-op', () => {
    const store = new SelectionStore();
    store.selectAllMatching(null, null);
    expect(store.selection()).toEqual({ kind: 'keys', keys: [] });
  });
});

describe('SelectionStore.setMode', () => {
  it('clears the selection when switching to "none"', () => {
    const store = new SelectionStore();
    store.setMode('multiple');
    store.setSelectedKeys([1, 2, 3]);
    store.setMode('none');
    expect(store.selection()).toEqual({ kind: 'keys', keys: [] });
  });

  it('keeps only the first key when switching from "multiple" to "single"', () => {
    const store = new SelectionStore();
    store.setMode('multiple');
    store.setSelectedKeys([1, 2, 3]);
    store.setMode('single');
    expect(store.selectedKeys()).toEqual([1]);
  });

  it('is a no-op when the mode does not change', () => {
    const store = new SelectionStore();
    store.setMode('multiple');
    store.setSelectedKeys([1, 2]);
    store.setMode('multiple');
    expect(store.selectedKeys()).toEqual([1, 2]);
  });
});

describe('SelectionStore in mode "single"', () => {
  it('toggle selects, and toggling the same key again deselects it', () => {
    const store = new SelectionStore();
    store.setMode('single');
    store.toggle(1);
    expect(store.selectedKeys()).toEqual([1]);
    store.toggle(1);
    expect(store.selectedKeys()).toEqual([]);
  });

  it('toggling a different key replaces the selection', () => {
    const store = new SelectionStore();
    store.setMode('single');
    store.toggle(1);
    store.toggle(2);
    expect(store.selectedKeys()).toEqual([2]);
  });

  it('setSelectedKeys keeps only the first key', () => {
    const store = new SelectionStore();
    store.setMode('single');
    store.setSelectedKeys([1, 2, 3]);
    expect(store.selectedKeys()).toEqual([1]);
  });
});

describe('SelectionStore in mode "multiple"', () => {
  it('toggle accumulates and removes keys', () => {
    const store = new SelectionStore();
    store.setMode('multiple');
    store.toggle(1);
    store.toggle(2);
    expect(store.selectedKeys().slice().sort()).toEqual([1, 2]);
    store.toggle(1);
    expect(store.selectedKeys()).toEqual([2]);
  });

  it('setSelectedKeys replaces the selection', () => {
    const store = new SelectionStore();
    store.setMode('multiple');
    store.toggle(1);
    store.setSelectedKeys([2, 3]);
    expect(store.selectedKeys().slice().sort()).toEqual([2, 3]);
  });

  describe('selectAllMatching', () => {
    const filter: FilterNode = { field: 'status', op: 'eq', value: 'active' };

    it('produces an allMatching snapshot with the given filter/search and empty exclusions', () => {
      const store = new SelectionStore();
      store.setMode('multiple');
      store.selectAllMatching(filter, 'ada');
      expect(store.selection()).toEqual({
        kind: 'allMatching',
        filter,
        search: 'ada',
        exclusions: [],
      });
    });

    it('isSelected is true for an arbitrary key', () => {
      const store = new SelectionStore();
      store.setMode('multiple');
      store.selectAllMatching(filter, null);
      expect(store.isSelected(999)).toBe(true);
    });

    it('toggle adds the key to exclusions, and toggling again removes it', () => {
      const store = new SelectionStore();
      store.setMode('multiple');
      store.selectAllMatching(filter, null);
      store.toggle(5);
      expect(store.isSelected(5)).toBe(false);
      expect(store.selection()).toEqual({
        kind: 'allMatching',
        filter,
        search: null,
        exclusions: [5],
      });
      store.toggle(5);
      expect(store.isSelected(5)).toBe(true);
      expect(store.selection()).toEqual({
        kind: 'allMatching',
        filter,
        search: null,
        exclusions: [],
      });
    });

    it('selectedKeys is empty', () => {
      const store = new SelectionStore();
      store.setMode('multiple');
      store.selectAllMatching(filter, null);
      expect(store.selectedKeys()).toEqual([]);
    });
  });
});

describe('SelectionStore.selectRange', () => {
  const keys = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13];

  const multiple = (): SelectionStore => {
    const store = new SelectionStore();
    store.setMode('multiple');
    return store;
  };

  const selected = (store: SelectionStore): number[] =>
    (store.selectedKeys() as number[]).slice().sort((a, b) => a - b);

  it('keeps an earlier range when a later one starts', () => {
    const store = multiple();
    store.toggle(2);
    store.selectRange(5, keys);
    store.toggle(10);
    store.selectRange(13, keys);
    expect(selected(store)).toEqual([2, 3, 4, 5, 10, 11, 12, 13]);
  });

  it('shrinks the live range without touching rows selected before the anchor', () => {
    const store = multiple();
    store.toggle(9);
    store.toggle(2);
    store.selectRange(5, keys);
    expect(selected(store)).toEqual([2, 3, 4, 5, 9]);
    store.selectRange(3, keys);
    expect(selected(store)).toEqual([2, 3, 9]);
  });

  it('measures a reversed range from the same anchor', () => {
    const store = multiple();
    store.toggle(5);
    store.selectRange(2, keys);
    expect(selected(store)).toEqual([2, 3, 4, 5]);
  });

  it('never deselects: a range over a row unchecked at the anchor selects it back', () => {
    const store = multiple();
    store.setSelectedKeys([2, 3, 4, 5, 6]);
    store.toggle(4);
    expect(selected(store)).toEqual([2, 3, 5, 6]);
    store.selectRange(6, keys);
    expect(selected(store)).toEqual([2, 3, 4, 5, 6]);
  });

  it('replaces the selection when a plain click starts the range', () => {
    const store = multiple();
    store.setSelectedKeys([8, 9]);
    store.select(2);
    store.selectRange(4, keys);
    expect(selected(store)).toEqual([2, 3, 4]);
  });

  it('falls back to the current selection as the base after a programmatic set', () => {
    const store = multiple();
    store.toggle(9);
    store.setSelectedKeys([1, 2]);
    store.selectRange(7, keys);
    expect(selected(store)).toEqual([1, 2, 7, 8, 9]);
  });

  it('behaves as a plain selection with no anchor', () => {
    const store = multiple();
    store.selectRange(4, keys);
    expect(selected(store)).toEqual([4]);
  });

  it('takes back exclusions in allMatching form instead of collapsing it', () => {
    const store = multiple();
    store.selectAllMatching(null, null);
    store.toggle(2);
    store.toggle(3);
    store.toggle(9);
    store.selectRange(4, keys);
    expect(store.selection()).toEqual({
      kind: 'allMatching',
      filter: null,
      search: null,
      exclusions: [2, 3],
    });
  });

  it('is a plain selection in mode "single"', () => {
    const store = new SelectionStore();
    store.setMode('single');
    store.toggle(2);
    store.selectRange(5, keys);
    expect(store.selectedKeys()).toEqual([5]);
  });
});

describe('SelectionStore.restore', () => {
  const keys = [1, 2, 3, 4, 5];

  it('puts back the range base, so a refused click does not widen the next range', () => {
    const store = new SelectionStore();
    store.setMode('multiple');
    store.toggle(1);
    const before = store.selection();
    const anchor = store.anchorState();
    store.toggle(4);
    store.restore(before, anchor);
    store.selectRange(3, keys);
    expect((store.selectedKeys() as number[]).slice().sort()).toEqual([1, 2, 3]);
  });
});

describe('SelectionStore.clear', () => {
  it('returns to the empty keys form', () => {
    const store = new SelectionStore();
    store.setMode('multiple');
    store.selectAllMatching(null, null);
    store.clear();
    expect(store.selection()).toEqual({ kind: 'keys', keys: [] });
  });
});

describe('SelectionStore.retainKeys', () => {
  it('drops keys that are not in the given set, in keys form', () => {
    const store = new SelectionStore();
    store.setMode('multiple');
    store.setSelectedKeys([1, 2, 3]);
    store.retainKeys(new Set([1, 3]));
    expect(store.selectedKeys().slice().sort()).toEqual([1, 3]);
  });

  it('is a no-op in allMatching form', () => {
    const store = new SelectionStore();
    store.setMode('multiple');
    store.selectAllMatching(null, null);
    store.retainKeys(new Set([1]));
    expect(store.selection()).toEqual({
      kind: 'allMatching',
      filter: null,
      search: null,
      exclusions: [],
    });
  });
});

describe('SelectionStore.selection', () => {
  it('returns keys as a plain array, not a Set', () => {
    const store = new SelectionStore();
    store.setMode('multiple');
    store.setSelectedKeys([1, 2]);
    const snapshot = store.selection();
    if (snapshot.kind !== 'keys') {
      throw new Error('expected keys form');
    }
    expect(Array.isArray(snapshot.keys)).toBe(true);
  });

  it('returns exclusions as a plain array, not a Set, in allMatching form', () => {
    const store = new SelectionStore();
    store.setMode('multiple');
    store.selectAllMatching(null, null);
    store.toggle(5);
    const snapshot = store.selection();
    if (snapshot.kind !== 'allMatching') {
      throw new Error('expected allMatching form');
    }
    expect(Array.isArray(snapshot.exclusions)).toBe(true);
  });
});
