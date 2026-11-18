/**
 * Grid state serialization: lossless with respect to everything a user can
 * arrange, versioned, and tolerant of columns that no longer exist.
 *
 * Applying a state writes every facet synchronously, so the connected data
 * store issues exactly one query.
 */
import { columnField } from './column.store';
import { structurallyEqual } from './equality';
import type { RelativeColumnFilter } from './query.store.types';
import type { FilterNode } from './types/filter.types';
import type { SortSpec } from './types/query.types';
import type {
  ApplyStateReport,
  GridColumnState,
  GridState,
  GridStateMigration,
  GridStateOptions,
} from './types/state.types';
import type { GridStateStores } from './state.types';
/** Current schema version of {@link GridState}. */
export const GRID_STATE_VERSION = 1;

/** Serializes the current arrangement. Volatile values are excluded by default. */
export function serializeGridState<TRow>(
  stores: GridStateStores<TRow>,
  options?: GridStateOptions,
): GridState {
  const { columns, query } = stores;
  const entries = columns.layoutState();
  const byId = new Map(entries.map((entry) => [entry.id, entry]));
  const fieldToId = new Map(columns.columns().map((def) => [columnField(def), def.id]));

  query.sort().forEach((spec, index) => {
    const entry = byId.get(fieldToId.get(spec.field) ?? '');
    if (entry) {
      entry.sort = { order: spec.desc ? 'desc' : 'asc', index };
    }
  });
  // Grouping is written twice on purpose: `GridState.grouping` carries the
  // levels a source that groups nothing locally still has to be told about,
  // and the per-column entry is what survives a column being renamed away.
  query.group().forEach((spec, index) => {
    const entry = byId.get(fieldToId.get(spec.field) ?? '');
    if (entry) {
      entry.group = { index };
    }
  });
  for (const [columnId, filter] of query.columnFilters()) {
    const entry = byId.get(columnId);
    if (entry) {
      entry.filter = filter;
    }
  }
  for (const [columnId, filter] of query.headerFilters()) {
    const entry = byId.get(columnId);
    if (entry) {
      entry.headerFilter = filter;
    }
  }
  for (const [columnId, relative] of query.relativeDateFilters()) {
    const entry = byId.get(columnId);
    if (entry) {
      entry.relativeDateFilter = relative.filter;
    }
  }

  const state: GridState = { version: GRID_STATE_VERSION, columns: entries };
  const filter = query.filter();
  if (filter != null) {
    state.filter = filter;
  }
  const search = query.search();
  if (search != null) {
    state.search = search;
  }
  const pageSize = query.pageSize();
  if (pageSize != null) {
    state.pageSize = pageSize;
  }
  const grouping = query.group();
  if (grouping.length > 0) {
    state.grouping = [...grouping];
  }
  if (options?.volatile === true && stores.volatile != null) {
    state.volatile = stores.volatile.read();
  }
  return state;
}

function migrateIfNeeded(
  state: GridState,
  migrate: GridStateMigration | undefined,
): GridState | null {
  if (state.version === GRID_STATE_VERSION) {
    return state;
  }
  const migrated = migrate?.(state) ?? null;
  return migrated?.version === GRID_STATE_VERSION ? migrated : null;
}

/**
 * Applies a state atomically. Entries for unknown columns are ignored and
 * reported. A state from another version goes through the migration hook
 * first; without one (or when migration declines) nothing is applied.
 */
export function applyGridState<TRow>(
  stores: GridStateStores<TRow>,
  state: GridState,
  options?: { migrate?: GridStateMigration },
): ApplyStateReport {
  const migrated = migrateIfNeeded(state, options?.migrate);
  if (migrated == null) {
    return { applied: false, droppedColumnIds: [] };
  }
  const { columns, query } = stores;
  const dropped = new Set(columns.applyLayoutState(migrated.columns));
  const idToField = new Map(columns.columns().map((def) => [def.id, columnField(def)]));

  const sortEntries: { field: string; desc: boolean; index: number }[] = [];
  const columnFilters = new Map<string, FilterNode>();
  const headerFilters = new Map<string, FilterNode>();
  const relativeFilters = new Map<string, RelativeColumnFilter>();
  for (const entry of migrated.columns) {
    const field = idToField.get(entry.id);
    if (field === undefined) {
      dropped.add(entry.id);
      continue;
    }
    if (entry.sort != null) {
      sortEntries.push({
        field,
        desc: entry.sort.order === 'desc',
        index: entry.sort.index ?? 0,
      });
    }
    if (entry.filter != null) {
      columnFilters.set(entry.id, entry.filter);
    }
    if (entry.headerFilter != null) {
      headerFilters.set(entry.id, entry.headerFilter);
    }
    if (entry.relativeDateFilter != null) {
      relativeFilters.set(entry.id, { field, filter: entry.relativeDateFilter });
    }
  }
  sortEntries.sort((a, b) => a.index - b.index);
  // Omit a false `desc` so a round-tripped spec matches the original exactly.
  const sort: SortSpec[] = sortEntries.map((entry) =>
    entry.desc ? { field: entry.field, desc: true } : { field: entry.field },
  );

  query.setSort(sort);
  query.setColumnFilters(columnFilters);
  query.setHeaderFilters(headerFilters);
  query.setRelativeDateFilters(relativeFilters);
  query.setFilter(migrated.filter ?? null);
  query.setSearch(migrated.search ?? null);
  if (migrated.pageSize != null) {
    query.setPageSize(migrated.pageSize);
  }
  query.setGroup(migrated.grouping ?? deriveGrouping(migrated.columns, idToField));
  // Written last, and inside the same synchronous batch: a page index restored
  // before the filters would be reset by every setter that follows it.
  if (migrated.volatile != null && stores.volatile != null) {
    stores.volatile.write(migrated.volatile);
  }
  return { applied: true, droppedColumnIds: [...dropped] };
}

/**
 * Grouping from the per-column entries, for a state written before
 * `GridState.grouping` existed or by a host that only set the column entries.
 */
function deriveGrouping(
  entries: readonly GridColumnState[],
  idToField: ReadonlyMap<string, string>,
): { field: string; desc?: boolean }[] {
  return entries
    .filter((entry) => entry.group != null)
    .sort((a, b) => (a.group?.index ?? 0) - (b.group?.index ?? 0))
    .map((entry) => idToField.get(entry.id))
    .filter((field): field is string => field !== undefined)
    .map((field) => ({ field }));
}

/**
 * Structural equality of two states, insensitive to column array order and
 * to absent, `undefined` and `null` members. Backs the dirty comparison.
 *
 * The volatile half is ignored on purpose: dirty means the arrangement moved
 * away from the saved one, and scrolling or selecting a row is neither an
 * arrangement nor something a host should be asked to save.
 */
export function gridStatesEqual(a: GridState, b: GridState): boolean {
  const normalize = (state: GridState): Omit<GridState, 'volatile'> => {
    const { volatile: _volatile, ...rest } = state;
    void _volatile;
    return {
      ...withoutNulls(rest),
      columns: [...state.columns]
        .sort((left, right) => left.id.localeCompare(right.id))
        .map(withoutNulls),
    };
  };
  return structurallyEqual(normalize(a), normalize(b));
}

/**
 * Whether the arrangement on screen is still a saved view, as far as the grid can apply it.
 *
 * A view outlives the columns it was saved with. A column added later has no entry in it, and
 * the entry of a removed column cannot be applied, so `gridStatesEqual` stays false and a revert
 * cannot change that. Only the columns that both states name are compared, with positions ranked
 * again among them. A column the view does not name keeps its layout through an apply. Its sort
 * and filters are cleared, so they must be absent.
 */
export function gridViewStatesEqual(current: GridState, saved: GridState): boolean {
  const named = new Set(saved.columns.map((entry) => entry.id));
  const present = new Set(current.columns.map((entry) => entry.id));
  if (current.columns.some((entry) => !named.has(entry.id) && hasQueryFacet(entry))) {
    return false;
  }
  return gridStatesEqual(
    { ...current, columns: rankAgain(current.columns.filter((entry) => named.has(entry.id))) },
    { ...saved, columns: rankAgain(saved.columns.filter((entry) => present.has(entry.id))) },
  );
}

function hasQueryFacet(entry: GridColumnState): boolean {
  return (
    entry.sort != null ||
    entry.group != null ||
    entry.filter != null ||
    entry.headerFilter != null ||
    entry.relativeDateFilter != null
  );
}

/** Numbers the visible position, the sort and the group of each entry from 0, in their order. */
function rankAgain(entries: readonly GridColumnState[]): GridColumnState[] {
  const visible = ranks(entries, (entry) =>
    entry.visible === false ? undefined : entry.visibleIndex,
  );
  const sorted = ranks(entries, (entry) =>
    entry.sort == null ? undefined : (entry.sort.index ?? 0),
  );
  const grouped = ranks(entries, (entry) => entry.group?.index);
  return entries.map((entry) => ({
    ...entry,
    visibleIndex: visible.get(entry.id),
    ...(entry.sort == null ? {} : { sort: { ...entry.sort, index: sorted.get(entry.id) } }),
    ...(entry.group == null
      ? {}
      : { group: { ...entry.group, index: grouped.get(entry.id) ?? 0 } }),
  }));
}

function ranks(
  entries: readonly GridColumnState[],
  key: (entry: GridColumnState) => number | undefined,
): Map<string, number> {
  return new Map(
    entries
      .flatMap((entry) => {
        const value = key(entry);
        return value === undefined ? [] : [{ id: entry.id, value }];
      })
      .sort((a, b) => a.value - b.value)
      .map((entry, rank) => [entry.id, rank]),
  );
}

/**
 * Drops the members set to `null`. `applyGridState` reads `null` as "none", so a
 * host-built `filter: null` must equal the absent member the grid serializes.
 * One level only: inside a filter node, `value: null` is data.
 */
function withoutNulls<T extends object>(record: T): T {
  return Object.fromEntries(Object.entries(record).filter(([, value]) => value !== null)) as T;
}
