/**
 * Sort toggling.
 *
 * Sort criteria are ordered: position in the array is the multi-sort ordinal.
 * A column already in the list keeps its position when its direction changes,
 * so cycling a criterion never reshuffles the ones around it.
 */
import type { ColumnDef } from './types/column.types';
import type { SortSpec } from './types/query.types';
import type { SortCycle, SortDirection, SortToggleOptions } from './sort-cycle.types';

/** The field a column sorts by, which may differ from the field it displays. */
export function sortFieldOf<TRow>(column: ColumnDef<TRow>): string {
  return column.sort?.field ?? column.field ?? column.id;
}

export function sortDirectionOf(specs: readonly SortSpec[], field: string): SortDirection | null {
  const spec = specs.find((candidate) => candidate.field === field);
  if (spec === undefined) {
    return null;
  }
  return spec.desc === true ? 'desc' : 'asc';
}

/**
 * 1-based position among the criteria, or `null` when the field is unsorted
 * or is the only criterion. A lone criterion needs no ordinal badge.
 */
export function sortOrdinalOf(specs: readonly SortSpec[], field: string): number | null {
  if (specs.length < 2) {
    return null;
  }
  const index = specs.findIndex((candidate) => candidate.field === field);
  return index < 0 ? null : index + 1;
}

function nextDirection(current: SortDirection | null, cycle: SortCycle): SortDirection | null {
  if (current === null) {
    return 'asc';
  }
  if (current === 'asc') {
    return 'desc';
  }
  return cycle === 'asc-desc' ? 'asc' : null;
}

/** Builds a spec, omitting a false `desc` so round-tripped state compares equal. */
function toSpec(field: string, direction: SortDirection): SortSpec {
  return direction === 'desc' ? { field, desc: true } : { field };
}

/**
 * Applies one sort activation and returns the new criteria.
 *
 * Single mode replaces the whole list; multi mode edits this field in place
 * and appends it when new. Cycling a field to `none` removes it.
 */
export function toggleSort(
  specs: readonly SortSpec[],
  field: string,
  options: SortToggleOptions = {},
): SortSpec[] {
  const cycle = options.cycle ?? 'asc-desc-none';
  // `force: null` clears this column and `force: undefined` means "advance the
  // cycle", so the two cannot collapse into a `??`.
  const direction =
    options.force === undefined
      ? nextDirection(sortDirectionOf(specs, field), cycle)
      : options.force;

  if (options.multi !== true) {
    return direction === null ? [] : [toSpec(field, direction)];
  }
  const index = specs.findIndex((candidate) => candidate.field === field);
  const next = [...specs];
  if (direction === null) {
    if (index >= 0) {
      next.splice(index, 1);
    }
    return next;
  }
  const spec = toSpec(field, direction);
  if (index >= 0) {
    next[index] = spec;
  } else {
    next.push(spec);
  }
  return next;
}

/**
 * The criteria a column set declares, ordered by `sort.index`. Columns
 * without an index keep their declaration order after the indexed ones.
 */
export function initialSort<TRow>(columns: readonly ColumnDef<TRow>[]): SortSpec[] {
  return columns
    .map((column, position) => ({ column, position }))
    .filter((entry) => entry.column.sort?.order !== undefined)
    .sort((a, b) => {
      const left = a.column.sort?.index ?? Number.MAX_SAFE_INTEGER;
      const right = b.column.sort?.index ?? Number.MAX_SAFE_INTEGER;
      return left === right ? a.position - b.position : left - right;
    })
    .map((entry) => toSpec(sortFieldOf(entry.column), entry.column.sort?.order ?? 'asc'));
}

/**
 * Maps sort fields back to local comparators and sort values. Two columns
 * can name the same field; the first one declaring an override wins.
 */
export function sortResolverFor<TRow>(
  columns: readonly ColumnDef<TRow>[],
): (
  field: string,
) =>
  | { getSortValue?: (row: TRow) => unknown; comparator?: (a: unknown, b: unknown) => number }
  | undefined {
  const overrides = new Map<
    string,
    { getSortValue?: (row: TRow) => unknown; comparator?: (a: unknown, b: unknown) => number }
  >();
  for (const column of columns) {
    const field = sortFieldOf(column);
    if (overrides.has(field)) {
      continue;
    }
    const entry: {
      getSortValue?: (row: TRow) => unknown;
      comparator?: (a: unknown, b: unknown) => number;
    } = {};
    const sortValue = column.sortValue ?? column.value;
    if (sortValue !== undefined) {
      entry.getSortValue = sortValue;
    }
    if (column.sort?.comparator !== undefined) {
      entry.comparator = column.sort.comparator;
    }
    if (entry.getSortValue !== undefined || entry.comparator !== undefined) {
      overrides.set(field, entry);
    }
  }
  return (field) => overrides.get(field);
}
