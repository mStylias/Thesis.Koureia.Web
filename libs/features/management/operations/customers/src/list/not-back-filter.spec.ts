import { where, type FilterNode } from '@ui/data-source';

import { COLUMN } from '../customers.columns';
import { readNotBack, writeNotBack } from './not-back-filter';
import type { NotBackGrid } from './not-back-filter.types';

/** The two filter-row slots the quick filter reads and writes, as the grid holds them. */
function fakeGrid(initial: Record<string, FilterNode> = {}): NotBackGrid & {
  readonly filters: Map<string, FilterNode>;
} {
  const filters = new Map(Object.entries(initial));
  return {
    filters,
    getColumnFilter: (id) => filters.get(id) ?? null,
    setColumnFilter: (id, node) => {
      if (node === null) filters.delete(id);
      else filters.set(id, node);
    },
    clearColumnFilter: (id) => {
      filters.delete(id);
    },
  };
}

describe('the "not back for" quick filter', () => {
  it('writes a choice as two ordinary filters', () => {
    const grid = fakeGrid();

    writeNotBack(grid, 60);

    expect(grid.filters.get(COLUMN.daysSinceLastVisit)).toEqual(
      where('daysSinceLastVisit', 'ge', 60),
    );
    expect(grid.filters.get(COLUMN.upcomingCount)).toEqual(where('upcomingCount', 'eq', 0));
    expect(readNotBack(grid)).toBe(60);
  });

  it('reads "everyone" once a filter is changed by hand', () => {
    const grid = fakeGrid();
    writeNotBack(grid, 90);

    grid.setColumnFilter(COLUMN.daysSinceLastVisit, where('daysSinceLastVisit', 'ge', 45));
    expect(readNotBack(grid)).toBeNull();

    writeNotBack(grid, 90);
    grid.clearColumnFilter(COLUMN.upcomingCount);
    expect(readNotBack(grid)).toBeNull();
  });

  it('reads the same filters set by hand as the matching choice', () => {
    const grid = fakeGrid({
      [COLUMN.daysSinceLastVisit]: where('daysSinceLastVisit', 'ge', 30),
      [COLUMN.upcomingCount]: where('upcomingCount', 'eq', 0),
    });

    expect(readNotBack(grid)).toBe(30);
  });

  it('clears its own filters on "everyone", and leaves a hand-made one alone', () => {
    const grid = fakeGrid();
    writeNotBack(grid, 180);
    writeNotBack(grid, null);
    expect(grid.filters.size).toBe(0);

    grid.setColumnFilter(COLUMN.daysSinceLastVisit, where('daysSinceLastVisit', 'ge', 10));
    writeNotBack(grid, null);
    expect(grid.filters.get(COLUMN.daysSinceLastVisit)).toEqual(
      where('daysSinceLastVisit', 'ge', 10),
    );
  });
});
