import { rangeBetween, selectAllState } from './selection-range';
import type { GridKey } from './types/key.types';

describe('rangeBetween', () => {
  const keys: GridKey[] = [1, 2, 3, 4, 5];

  it('returns the keys in list order for a forward range', () => {
    expect(rangeBetween(keys, 2, 4)).toEqual([2, 3, 4]);
  });

  it('returns the same keys in list order for a backward range', () => {
    expect(rangeBetween(keys, 4, 2)).toEqual([2, 3, 4]);
  });

  it('returns a single key when anchor and target are the same', () => {
    expect(rangeBetween(keys, 3, 3)).toEqual([3]);
  });

  it('returns just the target when the anchor is missing from the list', () => {
    expect(rangeBetween(keys, 99, 4)).toEqual([4]);
  });

  it('returns an empty array when the target is missing from the list', () => {
    expect(rangeBetween(keys, 2, 99)).toEqual([]);
  });
});

describe('selectAllState', () => {
  it("returns 'none' for an empty list", () => {
    expect(selectAllState([], () => true)).toBe('none');
  });

  it("returns 'none' when no key is selected", () => {
    expect(selectAllState([1, 2, 3], () => false)).toBe('none');
  });

  it("returns 'some' when only part of the keys are selected", () => {
    const selected = new Set<GridKey>([1]);
    expect(selectAllState([1, 2, 3], (key) => selected.has(key))).toBe('some');
  });

  it("returns 'all' when every key is selected", () => {
    expect(selectAllState([1, 2, 3], () => true)).toBe('all');
  });
});
