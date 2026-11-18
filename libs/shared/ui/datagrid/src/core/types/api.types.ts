/**
 * Imperative grid API.
 *
 * Obtainable at initialization and via a template reference. All calls are
 * safe before first render (queued) and after destruction (no-op with a
 * development warning).
 */
import type { GridTemporaryView } from '../../features.types';
import type { ColumnDef } from './column.types';
import type { ExportOptions } from './export.types';
import type { FilterNode } from './filter.types';
import type { GridKey } from './key.types';
import type { GroupSpec, Query, SortSpec } from './query.types';
import type { ApplyStateReport, GridState, GridStateOptions } from './state.types';

/** A keyed partial update of one row. */
import type { RowChange, RowTransaction } from '@ui/data-source';

export type { RowChange, RowTransaction };

/** The pending change set of batch editing. */
export interface PendingChanges<TRow = unknown> {
  inserts: readonly TRow[];
  updates: readonly RowChange<TRow>[];
  removes: readonly GridKey[];
}

/**
 * Selection as data. `'allMatching'` is a predicate — the filter at the time
 * of select-all plus explicit exclusions — never a materialized key list.
 */
export type SelectionSnapshot =
  | { kind: 'keys'; keys: readonly GridKey[] }
  | {
      kind: 'allMatching';
      filter: FilterNode | null;
      search: string | null;
      exclusions: readonly GridKey[];
    };

/** A focused cell position, by key and column id. */
export interface CellPosition {
  key: GridKey;
  columnId: string;
}

/** Scroll offsets in pixels. */
export interface ScrollPosition {
  top: number;
  left: number;
}

/** The stable imperative API of one grid instance. */
export interface GridApi<TRow = unknown> {
  // --- data ---
  /**
   * Re-run the current query (§12's refresh).
   *
   * Relative date filters are re-evaluated against the current instant, and
   * scroll, selection and expansion are preserved: all three are keyed, and
   * rows that come back unchanged are not torn down. Emits `refreshRequested`
   * first, so a host that owns its own data can respond to it.
   */
  reload(): void;
  /** Return to the initial query. */
  reset(): void;
  /** Merge facets into the current query and re-load once. */
  applyQuery(query: Partial<Query>): void;
  getQuery(): Query;
  /** The currently loaded rows. */
  getRows(): readonly TRow[];
  getRow(key: GridKey): TRow | undefined;
  getTotalCount(): number | undefined;
  /** Re-render one row from its current data. */
  refreshRow(key: GridKey): void;
  /**
   * Apply keyed inserts, updates and removes without a reload.
   *
   * Only the rows the transaction names are re-rendered: every other row keeps
   * its identity and its cached view model. An insert whose key is already
   * loaded updates that row in place rather than adding a second row under one
   * key.
   */
  applyTransaction(transaction: RowTransaction<TRow>): void;

  // --- columns ---
  getColumns(): readonly ColumnDef<TRow>[];
  /** Visible columns in display order. */
  getVisibleColumns(): readonly ColumnDef<TRow>[];
  setColumnVisible(id: string, visible: boolean): void;
  setColumnWidth(id: string, width: number | 'auto'): void;
  /** Move a column to a position among visible columns. */
  moveColumn(id: string, index: number): void;
  pinColumn(id: string, side: 'start' | 'end' | false): void;
  /** Size every resizable column to its content. */
  autoSizeColumns(): void;

  // --- state ---
  /**
   * The arrangement, as JSON-serializable data.
   *
   * Page index, scroll offsets, selection, expansion and focus are excluded
   * unless `volatile` asks for them.
   */
  getState(options?: GridStateOptions): GridState;
  /** Apply a state atomically. Issues exactly one data query. */
  setState(state: GridState): ApplyStateReport;
  /** Return to the arrangement declared in the config. */
  resetState(): void;
  /**
   * Opens a view made for this visit and never stored, and applies it: one query. Needs the
   * `gridViews` feature. See {@link GridTemporaryView}.
   */
  openTemporaryView(view: GridTemporaryView): void;
  /** Closes the temporary view. When it was on screen, the default view is applied. */
  closeTemporaryView(): void;
  /**
   * Structural comparison against a reference state, for a save/discard
   * affordance. Insensitive to column order, to absent-versus-`undefined`
   * properties and to the volatile half.
   */
  isDirty(reference: GridState): boolean;

  // --- filtering / sorting / grouping ---
  /** The user filter: every column filter combined with the free tree. */
  getFilter(): FilterNode | null;
  /** Replaces the free tree. Column filters are untouched. */
  setFilter(node: FilterNode | null): void;
  /**
   * The sub-tree the **filter row** owns on one column.
   *
   * A column has two slots. The header filter owns the other one, reached
   * through {@link getHeaderFilter}, and the two combine with `and`. Writing
   * here leaves the header filter's selection in place.
   */
  getColumnFilter(columnId: string): FilterNode | null;
  setColumnFilter(columnId: string, node: FilterNode | null): void;
  /** The sub-tree the **header filter** owns on one column. */
  getHeaderFilter(columnId: string): FilterNode | null;
  setHeaderFilter(columnId: string, node: FilterNode | null): void;
  /** Drops the header filter alone, leaving the filter row's condition. */
  clearHeaderFilter(columnId: string): void;
  /** Clear-single-column of §7.5. Drops both slots and the relative period. */
  clearColumnFilter(columnId: string): void;
  /** Clear-all-filters of §7.5: both slots, relative periods and search. */
  clearFilters(): void;
  getSearch(): string | null;
  setSearch(term: string | null): void;
  getSort(): readonly SortSpec[];
  setSort(spec: readonly SortSpec[]): void;
  getGroup(): readonly GroupSpec[];
  setGroup(spec: readonly GroupSpec[]): void;
  /** Expand one group by its key path. */
  expandGroup(path: readonly unknown[]): void;
  collapseGroup(path: readonly unknown[]): void;
  expandAllGroups(): void;
  collapseAllGroups(): void;

  // --- selection and focus ---
  getSelectedKeys(): readonly GridKey[];
  getSelectedRows(): readonly TRow[];
  setSelectedKeys(keys: readonly GridKey[]): void;
  clearSelection(): void;
  /** Select every row matching the current filter, as a predicate. */
  selectAllMatching(): void;
  /** Selection as data, safe for remote sources. */
  getSelection(): SelectionSnapshot;
  focusCell(key: GridKey, columnId: string): void;
  getFocusedCell(): CellPosition | null;

  // --- rows ---
  expandRow(key: GridKey): void;
  collapseRow(key: GridKey): void;
  getExpandedKeys(): readonly GridKey[];

  // --- editing ---
  startEdit(key: GridKey, columnId?: string): void;
  /** Resolves `true` when the commit passed validation and persisted. */
  commitEdit(): Promise<boolean>;
  cancelEdit(): void;
  getPendingChanges(): PendingChanges<TRow>;

  // --- view ---
  scrollToRow(key: GridKey): void;
  scrollToColumn(id: string): void;
  getScrollPosition(): ScrollPosition;
  setScrollPosition(position: ScrollPosition): void;
  /**
   * Export through the adapter registered for the format (§15).
   *
   * Resolves when the file has been handed to the saver, and also when the
   * run was vetoed by `beforeExport` or canceled — the outcome travels as an
   * event, so one refused export is not an unhandled rejection. A withheld
   * `exporting` capability refuses the call outright.
   */
  export(format: string, options?: ExportOptions): Promise<void>;
  /**
   * Copy the export model as tab-separated text (§15).
   *
   * Defaults to the selected rows, and to the focused row when nothing is
   * selected. Resolves `false` when the platform offers no clipboard.
   */
  copyToClipboard(options?: ExportOptions): Promise<boolean>;
  /** Print the whole dataset, not the rows virtualization happens to mount. */
  print(): void;
  /** Force a full re-render. A last resort — normal updates are diffed. */
  repaint(): void;
}
