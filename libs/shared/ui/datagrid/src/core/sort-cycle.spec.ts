import {
  initialSort,
  sortDirectionOf,
  sortFieldOf,
  sortOrdinalOf,
  sortResolverFor,
  toggleSort,
} from './sort-cycle';
import type { ColumnDef } from './types/column.types';
import type { SortSpec } from './types/query.types';

describe('sortFieldOf', () => {
  it('falls back to id when neither field nor sort.field is set', () => {
    const column: ColumnDef = { id: 'a' };
    expect(sortFieldOf(column)).toBe('a');
  });

  it('falls back to field when sort.field is not set', () => {
    const column: ColumnDef = { id: 'a', field: 'aField' };
    expect(sortFieldOf(column)).toBe('aField');
  });

  it('prefers sort.field over field and id', () => {
    const column: ColumnDef = { id: 'a', field: 'aField', sort: { field: 'aSortField' } };
    expect(sortFieldOf(column)).toBe('aSortField');
  });
});

describe('sortDirectionOf', () => {
  it('returns null for an unknown field', () => {
    expect(sortDirectionOf([], 'a')).toBeNull();
  });

  it('returns asc for a spec with no desc flag', () => {
    expect(sortDirectionOf([{ field: 'a' }], 'a')).toBe('asc');
  });

  it('returns desc for a spec with desc: true', () => {
    expect(sortDirectionOf([{ field: 'a', desc: true }], 'a')).toBe('desc');
  });

  it('returns asc for a spec with an explicit desc: false', () => {
    expect(sortDirectionOf([{ field: 'a', desc: false }], 'a')).toBe('asc');
  });
});

describe('sortOrdinalOf', () => {
  it('returns null when there are fewer than 2 criteria, even if the field is sorted', () => {
    expect(sortOrdinalOf([{ field: 'a' }], 'a')).toBeNull();
  });

  it('returns null for an empty list', () => {
    expect(sortOrdinalOf([], 'a')).toBeNull();
  });

  it('returns the 1-based position among 2 or more criteria', () => {
    const specs: SortSpec[] = [{ field: 'a' }, { field: 'b' }, { field: 'c' }];
    expect(sortOrdinalOf(specs, 'a')).toBe(1);
    expect(sortOrdinalOf(specs, 'b')).toBe(2);
    expect(sortOrdinalOf(specs, 'c')).toBe(3);
  });

  it('returns null for a field not present among 2 or more criteria', () => {
    const specs: SortSpec[] = [{ field: 'a' }, { field: 'b' }];
    expect(sortOrdinalOf(specs, 'z')).toBeNull();
  });
});

describe('toggleSort', () => {
  describe('single mode, default cycle (asc-desc-none)', () => {
    it('activates an unsorted field as asc', () => {
      expect(toggleSort([], 'a')).toEqual([{ field: 'a' }]);
    });

    it('cycles asc to desc', () => {
      expect(toggleSort([{ field: 'a' }], 'a')).toEqual([{ field: 'a', desc: true }]);
    });

    it('cycles desc to none, clearing the criteria', () => {
      expect(toggleSort([{ field: 'a', desc: true }], 'a')).toEqual([]);
    });

    it('replaces the whole list when a different column is clicked', () => {
      const specs: SortSpec[] = [{ field: 'a' }];
      expect(toggleSort(specs, 'b')).toEqual([{ field: 'b' }]);
    });

    it('never emits a desc: false, only omits desc for ascending', () => {
      const result = toggleSort([], 'a');
      expect(result).toEqual([{ field: 'a' }]);
    });
  });

  describe("single mode, cycle: 'asc-desc'", () => {
    it('cycles asc to desc', () => {
      const result = toggleSort([{ field: 'a' }], 'a', { cycle: 'asc-desc' });
      expect(result).toEqual([{ field: 'a', desc: true }]);
    });

    it('cycles desc back to asc, never reaching none', () => {
      const result = toggleSort([{ field: 'a', desc: true }], 'a', { cycle: 'asc-desc' });
      expect(result).toEqual([{ field: 'a' }]);
    });
  });

  describe('multi mode', () => {
    it('appends a new field to the existing criteria', () => {
      const specs: SortSpec[] = [{ field: 'a' }];
      const result = toggleSort(specs, 'b', { multi: true });
      expect(result).toEqual([{ field: 'a' }, { field: 'b' }]);
    });

    it('changes an existing field direction in place, without moving its ordinal', () => {
      const specs: SortSpec[] = [{ field: 'a' }, { field: 'b' }, { field: 'c' }];
      const result = toggleSort(specs, 'b', { multi: true });
      expect(result).toEqual([{ field: 'a' }, { field: 'b', desc: true }, { field: 'c' }]);
      expect(sortOrdinalOf(specs, 'b')).toBe(2);
      expect(sortOrdinalOf(result, 'b')).toBe(2);
    });

    it('removes a field cycled to none and closes up the remaining ordinals', () => {
      const specs: SortSpec[] = [{ field: 'a' }, { field: 'b', desc: true }, { field: 'c' }];
      expect(sortOrdinalOf(specs, 'c')).toBe(3);
      const result = toggleSort(specs, 'b', { multi: true });
      expect(result).toEqual([{ field: 'a' }, { field: 'c' }]);
      expect(sortOrdinalOf(result, 'c')).toBe(2);
    });
  });

  describe('force', () => {
    it('applies the forced direction instead of the next one in the cycle', () => {
      const result = toggleSort([], 'a', { force: 'desc' });
      expect(result).toEqual([{ field: 'a', desc: true }]);
    });

    it('forces a direction even when the field is already sorted the other way', () => {
      const result = toggleSort([{ field: 'a', desc: true }], 'a', { force: 'asc' });
      expect(result).toEqual([{ field: 'a' }]);
    });
  });
});

describe('initialSort', () => {
  it('orders by sort.index, places un-indexed columns after in declaration order, and excludes columns without sort.order', () => {
    const columns: ColumnDef[] = [
      { id: 'a', sort: { order: 'asc', index: 1 } },
      { id: 'b', sort: { order: 'desc' } },
      { id: 'c', sort: { order: 'asc', index: 0 } },
      { id: 'd' },
      { id: 'e', sort: { order: 'desc' } },
    ];
    expect(initialSort(columns)).toEqual([
      { field: 'c' },
      { field: 'a' },
      { field: 'b', desc: true },
      { field: 'e', desc: true },
    ]);
  });

  it('returns an empty array when no column declares a sort order', () => {
    const columns: ColumnDef[] = [{ id: 'a' }, { id: 'b' }];
    expect(initialSort(columns)).toEqual([]);
  });
});

describe('sortResolverFor', () => {
  it('returns undefined for a field with no overrides', () => {
    const resolver = sortResolverFor<{ a: number }>([{ id: 'a' }]);
    expect(resolver('a')).toBeUndefined();
  });

  it('prefers sortValue over value', () => {
    const sortValue = (row: { a: number }): unknown => row.a;
    const value = (row: { a: number }): unknown => row.a * 2;
    const resolver = sortResolverFor<{ a: number }>([{ id: 'a', field: 'a', sortValue, value }]);
    const entry = resolver('a');
    expect(entry?.getSortValue).toBe(sortValue);
  });

  it('falls back to value when sortValue is absent', () => {
    const value = (row: { a: number }): unknown => row.a;
    const resolver = sortResolverFor<{ a: number }>([{ id: 'a', field: 'a', value }]);
    expect(resolver('a')?.getSortValue).toBe(value);
  });

  it('exposes the sort.comparator override', () => {
    const comparator = (a: unknown, b: unknown): number => Number(a) - Number(b);
    const resolver = sortResolverFor<{ a: number }>([
      { id: 'a', field: 'a', sort: { comparator } },
    ]);
    expect(resolver('a')?.comparator).toBe(comparator);
  });

  it('lets the first column declaring a field win when two columns share it', () => {
    const firstSortValue = (row: { a: number }): unknown => row.a;
    const secondSortValue = (row: { a: number }): unknown => row.a * 2;
    const resolver = sortResolverFor<{ a: number }>([
      { id: 'a1', field: 'a', sortValue: firstSortValue },
      { id: 'a2', field: 'a', sortValue: secondSortValue },
    ]);
    expect(resolver('a')?.getSortValue).toBe(firstSortValue);
  });
});
