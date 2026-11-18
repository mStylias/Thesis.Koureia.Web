/**
 * Serializable grid state.
 *
 * Lossless with respect to everything a user can arrange, JSON-serializable,
 * and free of functions, class instances and DOM references. Volatile values
 * (page index, scroll, selection, focus) are excluded by default.
 */
import type { FilterNode, RelativeDateFilter } from './filter.types';
import type { GridKey } from './key.types';
import type { GroupSpec } from './query.types';

/** Persisted arrangement of one column, keyed by the stable column id. */
export interface GridColumnState {
  id: string;
  visible?: boolean;
  visibleIndex?: number;
  width?: number | 'auto';
  pinned?: 'start' | 'end' | false;
  sort?: { order: 'asc' | 'desc'; index?: number };
  group?: { index: number; expanded?: boolean };
  /** The sub-tree the filter row owns. Combined with {@link headerFilter} by `and`. */
  filter?: FilterNode | null;
  /**
   * The sub-tree the header filter owns.
   *
   * Its own member rather than a merge into {@link filter}: the two surfaces
   * hold separate slots, and a state that merged them would restore into one
   * of them and lose the split. Absent in a state written before the split,
   * which restores with an empty header slot.
   */
  headerFilter?: FilterNode | null;
  /** Stored as a descriptor, re-evaluated against the current instant. */
  relativeDateFilter?: RelativeDateFilter | null;
}

/**
 * Where the user was, as opposed to how they arranged the grid.
 *
 * Excluded from a state by default and included through
 * {@link GridStateOptions}. It is separate from the arrangement because the
 * dirty comparison ignores it: scrolling is not an unsaved change, and a view
 * that reported itself dirty for it would ask to be saved forever.
 */
export interface GridVolatileState {
  pageIndex?: number;
  scroll?: { top: number; left: number };
  /** Keyed, so a restored selection survives rows arriving in another order. */
  selectedKeys?: readonly GridKey[];
  expandedKeys?: readonly GridKey[];
  focusedCell?: { key: GridKey; columnId: string } | null;
}

/** The serializable arrangement of the grid. */
export interface GridState {
  /** Schema version. See {@link GRID_STATE_VERSION}. */
  version: number;
  columns: GridColumnState[];
  /** The user filter tree not owned by a single column. */
  filter?: FilterNode | null;
  search?: string | null;
  pageSize?: number;
  grouping?: GroupSpec[];
  /** Present only when the state was taken with `volatile: true`. */
  volatile?: GridVolatileState;
}

/** How much of the grid a state carries. */
export interface GridStateOptions {
  /**
   * Include page index, scroll offsets, selection, expansion and focus.
   * Off by default: those describe where the user was, not how they arranged
   * the grid, and a saved view that restored them would drag every reader to
   * one person's scroll position.
   */
  volatile?: boolean;
}

/**
 * Migrates a persisted state from an earlier schema version. Return the
 * upgraded state, or `null` to discard it.
 */
export type GridStateMigration = (state: GridState) => GridState | null;

/** Result of applying a state. */
export interface ApplyStateReport {
  /** False when the state's version could not be migrated. */
  applied: boolean;
  /** Ids of state entries referencing columns that no longer exist. */
  droppedColumnIds: string[];
}
