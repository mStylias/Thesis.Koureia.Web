import { FocusStore, moveFocus, reconcileFocus } from './focus.store';
import type { FocusContext } from './focus.store.types';
import type { CellPosition } from './types/api.types';

function context(overrides: Partial<FocusContext> = {}): FocusContext {
  return { keys: ['a', 'b', 'c'], columnIds: ['c1', 'c2', 'c3'], pageStep: 2, ...overrides };
}

describe('moveFocus', () => {
  it('enters at the first cell when current is null', () => {
    expect(moveFocus(null, 'right', context())).toEqual({ key: 'a', columnId: 'c1' });
  });

  it('enters at the first cell when the current key is stale', () => {
    const current: CellPosition = { key: 'zzz', columnId: 'c1' };
    expect(moveFocus(current, 'right', context())).toEqual({ key: 'a', columnId: 'c1' });
  });

  it('enters at the first cell when the current columnId is stale', () => {
    const current: CellPosition = { key: 'a', columnId: 'zzz' };
    expect(moveFocus(current, 'right', context())).toEqual({ key: 'a', columnId: 'c1' });
  });

  it('moves one column left', () => {
    const current: CellPosition = { key: 'b', columnId: 'c2' };
    expect(moveFocus(current, 'left', context())).toEqual({ key: 'b', columnId: 'c1' });
  });

  it('moves one column right', () => {
    const current: CellPosition = { key: 'b', columnId: 'c2' };
    expect(moveFocus(current, 'right', context())).toEqual({ key: 'b', columnId: 'c3' });
  });

  it('moves one row up', () => {
    const current: CellPosition = { key: 'b', columnId: 'c2' };
    expect(moveFocus(current, 'up', context())).toEqual({ key: 'a', columnId: 'c2' });
  });

  it('moves one row down', () => {
    const current: CellPosition = { key: 'b', columnId: 'c2' };
    expect(moveFocus(current, 'down', context())).toEqual({ key: 'c', columnId: 'c2' });
  });

  it('saturates at the left edge instead of wrapping', () => {
    const current: CellPosition = { key: 'a', columnId: 'c1' };
    expect(moveFocus(current, 'left', context())).toEqual({ key: 'a', columnId: 'c1' });
  });

  it('saturates at the right edge instead of wrapping', () => {
    const current: CellPosition = { key: 'a', columnId: 'c3' };
    expect(moveFocus(current, 'right', context())).toEqual({ key: 'a', columnId: 'c3' });
  });

  it('saturates at the top edge instead of wrapping', () => {
    const current: CellPosition = { key: 'a', columnId: 'c1' };
    expect(moveFocus(current, 'up', context())).toEqual({ key: 'a', columnId: 'c1' });
  });

  it('saturates at the bottom edge instead of wrapping', () => {
    const current: CellPosition = { key: 'c', columnId: 'c1' };
    expect(moveFocus(current, 'down', context())).toEqual({ key: 'c', columnId: 'c1' });
  });

  it('rowStart jumps to the first column of the current row', () => {
    const current: CellPosition = { key: 'b', columnId: 'c2' };
    expect(moveFocus(current, 'rowStart', context())).toEqual({ key: 'b', columnId: 'c1' });
  });

  it('rowEnd jumps to the last column of the current row', () => {
    const current: CellPosition = { key: 'b', columnId: 'c2' };
    expect(moveFocus(current, 'rowEnd', context())).toEqual({ key: 'b', columnId: 'c3' });
  });

  it('gridStart jumps to the top-left corner', () => {
    const current: CellPosition = { key: 'b', columnId: 'c2' };
    expect(moveFocus(current, 'gridStart', context())).toEqual({ key: 'a', columnId: 'c1' });
  });

  it('gridEnd jumps to the bottom-right corner', () => {
    const current: CellPosition = { key: 'b', columnId: 'c2' };
    expect(moveFocus(current, 'gridEnd', context())).toEqual({ key: 'c', columnId: 'c3' });
  });

  describe('paging', () => {
    const ctx = context({ keys: ['a', 'b', 'c', 'd', 'e'], pageStep: 2 });

    it('pageDown moves down by context.pageStep', () => {
      const current: CellPosition = { key: 'c', columnId: 'c1' };
      expect(moveFocus(current, 'pageDown', ctx)).toEqual({ key: 'e', columnId: 'c1' });
    });

    it('pageUp moves up by context.pageStep', () => {
      const current: CellPosition = { key: 'c', columnId: 'c1' };
      expect(moveFocus(current, 'pageUp', ctx)).toEqual({ key: 'a', columnId: 'c1' });
    });

    it('pageUp clamps at the first row', () => {
      const current: CellPosition = { key: 'b', columnId: 'c1' };
      expect(moveFocus(current, 'pageUp', ctx)).toEqual({ key: 'a', columnId: 'c1' });
    });

    it('pageDown clamps at the last row', () => {
      const current: CellPosition = { key: 'd', columnId: 'c1' };
      expect(moveFocus(current, 'pageDown', ctx)).toEqual({ key: 'e', columnId: 'c1' });
    });

    it('treats a fractional pageStep as at least 1, floored', () => {
      const fractional = context({ keys: ['a', 'b', 'c', 'd', 'e'], pageStep: 2.9 });
      const current: CellPosition = { key: 'a', columnId: 'c1' };
      expect(moveFocus(current, 'pageDown', fractional)).toEqual({ key: 'c', columnId: 'c1' });
    });

    it('treats a pageStep below 1 as 1', () => {
      const tiny = context({ keys: ['a', 'b', 'c', 'd', 'e'], pageStep: 0.4 });
      const current: CellPosition = { key: 'a', columnId: 'c1' };
      expect(moveFocus(current, 'pageDown', tiny)).toEqual({ key: 'b', columnId: 'c1' });
    });

    it('treats a negative pageStep as 1', () => {
      const negative = context({ keys: ['a', 'b', 'c', 'd', 'e'], pageStep: -3 });
      const current: CellPosition = { key: 'a', columnId: 'c1' };
      expect(moveFocus(current, 'pageDown', negative)).toEqual({ key: 'b', columnId: 'c1' });
    });
  });

  it('returns null when there are no keys', () => {
    expect(moveFocus(null, 'right', context({ keys: [] }))).toBeNull();
  });

  it('returns null when there are no columnIds', () => {
    expect(moveFocus(null, 'right', context({ columnIds: [] }))).toBeNull();
  });
});

describe('reconcileFocus', () => {
  it('keeps focus and its column when the key survives', () => {
    const current: CellPosition = { key: 'b', columnId: 'c2' };
    const result = reconcileFocus(current, {
      previousKeys: ['a', 'b', 'c'],
      nextKeys: ['a', 'b', 'c'],
      columnIds: ['c1', 'c2'],
    });
    expect(result).toEqual({ key: 'b', columnId: 'c2' });
  });

  it('falls back to the first column when a surviving key lost its column', () => {
    const current: CellPosition = { key: 'b', columnId: 'zzz' };
    const result = reconcileFocus(current, {
      previousKeys: ['a', 'b', 'c'],
      nextKeys: ['a', 'b', 'c'],
      columnIds: ['c1', 'c2'],
    });
    expect(result).toEqual({ key: 'b', columnId: 'c1' });
  });

  it('hands focus to whatever now sits at the vanished key former index', () => {
    const current: CellPosition = { key: 'b', columnId: 'c1' };
    const result = reconcileFocus(current, {
      previousKeys: ['a', 'b', 'c'],
      nextKeys: ['x', 'y', 'z'],
      columnIds: ['c1'],
    });
    expect(result).toEqual({ key: 'y', columnId: 'c1' });
  });

  it('clamps to the last row when the vanished key former index is past the end', () => {
    const current: CellPosition = { key: 'e', columnId: 'c1' };
    const result = reconcileFocus(current, {
      previousKeys: ['a', 'b', 'c', 'd', 'e'],
      nextKeys: ['x', 'y'],
      columnIds: ['c1'],
    });
    expect(result).toEqual({ key: 'y', columnId: 'c1' });
  });

  it('returns null when the key is absent from both previous and next lists', () => {
    const current: CellPosition = { key: 'zzz', columnId: 'c1' };
    const result = reconcileFocus(current, {
      previousKeys: ['a', 'b'],
      nextKeys: ['x', 'y'],
      columnIds: ['c1'],
    });
    expect(result).toBeNull();
  });

  it('returns null when current is null', () => {
    const result = reconcileFocus(null, {
      previousKeys: ['a'],
      nextKeys: ['a'],
      columnIds: ['c1'],
    });
    expect(result).toBeNull();
  });

  it('returns null when nextKeys is empty', () => {
    const current: CellPosition = { key: 'a', columnId: 'c1' };
    const result = reconcileFocus(current, {
      previousKeys: ['a'],
      nextKeys: [],
      columnIds: ['c1'],
    });
    expect(result).toBeNull();
  });

  it('returns null when columnIds is empty', () => {
    const current: CellPosition = { key: 'a', columnId: 'c1' };
    const result = reconcileFocus(current, {
      previousKeys: ['a'],
      nextKeys: ['a'],
      columnIds: [],
    });
    expect(result).toBeNull();
  });
});

describe('FocusStore', () => {
  it('starts with cell() null', () => {
    const store = new FocusStore();
    expect(store.cell()).toBeNull();
  });

  it('focus() sets the cell and increments focusRequest()', () => {
    const store = new FocusStore();
    expect(store.focusRequest()).toBe(0);
    store.focus({ key: 'a', columnId: 'c1' });
    expect(store.cell()).toEqual({ key: 'a', columnId: 'c1' });
    expect(store.focusRequest()).toBe(1);
    store.focus({ key: 'b', columnId: 'c2' });
    expect(store.focusRequest()).toBe(2);
  });

  it('set() changes the cell without incrementing focusRequest(), so a background data refresh never steals DOM focus', () => {
    const store = new FocusStore();
    store.focus({ key: 'a', columnId: 'c1' });
    const requestBefore = store.focusRequest();
    store.set({ key: 'b', columnId: 'c2' });
    expect(store.cell()).toEqual({ key: 'b', columnId: 'c2' });
    expect(store.focusRequest()).toBe(requestBefore);
  });

  it('isFocused matches on both key and columnId, and is false when nothing is focused', () => {
    const store = new FocusStore();
    expect(store.isFocused('a', 'c1')).toBe(false);
    store.focus({ key: 'a', columnId: 'c1' });
    expect(store.isFocused('a', 'c1')).toBe(true);
    expect(store.isFocused('a', 'c2')).toBe(false);
    expect(store.isFocused('b', 'c1')).toBe(false);
  });

  it('clear() nulls the cell', () => {
    const store = new FocusStore();
    store.focus({ key: 'a', columnId: 'c1' });
    store.clear();
    expect(store.cell()).toBeNull();
  });
});
