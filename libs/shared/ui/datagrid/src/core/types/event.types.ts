/**
 * Event contract.
 *
 * Events are granular, typed, and — where the grid is about to act —
 * cancellable. Identical consecutive states never produce duplicate change
 * events, and a single user action never produces a burst of intermediate
 * events.
 */
import type { PendingChanges, RowChange, SelectionSnapshot } from './api.types';
import type { ExportTable } from './export.types';
import type { FilterNode } from './filter.types';
import type { GridKey } from './key.types';
import type { GridLoadError, GroupSpec, Query, QueryResult, SortSpec } from './query.types';
import type { GridState } from './state.types';

/** Whether a change came from the user or from host code. */
export type ChangeOrigin = 'user' | 'programmatic';

/** Base of every cancellable event. A handler sets `canceled` to veto. */
export interface Vetoable {
  canceled: boolean;
}

/** A pointer interaction with a row. */
export interface RowPointerEvent<TRow = unknown> {
  key: GridKey;
  row: TRow;
  event: MouseEvent;
}

/** A pointer interaction with a cell. */
export interface CellPointerEvent<TRow = unknown> extends RowPointerEvent<TRow> {
  columnId: string;
}

/** Payloads of every grid event, keyed by event name. */
export interface GridEventMap<TRow = unknown> {
  // --- lifecycle ---
  initialized: { api: unknown };
  /**
   * Fired once per data source identity, when the configuration and the
   * initial state have been applied and the first result has arrived.
   */
  firstSettled: Record<string, never>;
  destroyed: Record<string, never>;
  rendered: Record<string, never>;

  // --- data ---
  queryChanged: { query: Query };
  loadStarted: { query: Query };
  loadFinished: { query: Query; result: QueryResult<TRow> };
  loadFailed: { error: GridLoadError };
  dataChanged: { rows: readonly TRow[]; totalCount?: number };

  // --- state ---
  stateChanged: { state: GridState; origin: ChangeOrigin };
  columnResized: { columnId: string; width: number | 'auto' };
  /**
   * A column moved. Moving a band (§5.1) reports the band's id and the position
   * its first column landed on — a band has no position of its own, and one
   * event per column it carries would be the burst §20 forbids.
   */
  columnMoved: { columnId: string; visibleIndex: number };
  columnVisibilityChanged: { columnId: string; visible: boolean };
  sortChanged: { sort: readonly SortSpec[] };
  filterChanged: { filter: FilterNode | null };
  groupChanged: { group: readonly GroupSpec[] };
  pageChanged: { pageIndex: number };
  pageSizeChanged: { pageSize: number };

  // --- rows ---
  rowClick: RowPointerEvent<TRow>;
  rowDoubleClick: RowPointerEvent<TRow>;
  /** Row activation (double-click or Enter). Distinct from selection. */
  rowActivated: { key: GridKey; row: TRow };
  rowContextMenu: RowPointerEvent<TRow>;
  rowExpanding: { key: GridKey } & Vetoable;
  rowExpanded: { key: GridKey };
  rowCollapsing: { key: GridKey } & Vetoable;
  rowCollapsed: { key: GridKey };

  // --- cells ---
  cellClick: CellPointerEvent<TRow>;
  cellDoubleClick: CellPointerEvent<TRow>;
  cellFocused: { key: GridKey; columnId: string };
  /** Activation of the designated primary column's cell. */
  primaryCellActivated: { key: GridKey; row: TRow };

  // --- selection ---
  selectionChanging: { proposed: SelectionSnapshot } & Vetoable;
  selectionChanged: { selection: SelectionSnapshot };

  // --- editing ---
  editStarting: { key: GridKey; columnId?: string } & Vetoable;
  editStarted: { key: GridKey; columnId?: string };
  valueChanging: { key: GridKey; columnId: string; value: unknown } & Vetoable;
  rowValidating: { key: GridKey; changes: Partial<TRow>; errors: string[] } & Vetoable;
  saving: { changes: PendingChanges<TRow> } & Vetoable;
  saved: { changes: PendingChanges<TRow> };
  editCanceled: { key: GridKey };
  rowInserting: { row: TRow } & Vetoable;
  rowInserted: { key: GridKey; row: TRow };
  rowUpdating: { change: RowChange<TRow> } & Vetoable;
  rowUpdated: { key: GridKey; row: TRow };
  rowRemoving: { key: GridKey; row: TRow } & Vetoable;
  rowRemoved: { key: GridKey };

  // --- editors, toolbar, menus (mutable payloads) ---
  editorPreparing: { columnId: string; editor: Record<string, unknown> } & Vetoable;
  editorPrepared: { columnId: string };
  toolbarPreparing: { items: unknown[] };
  contextMenuPreparing: { key: GridKey | null; items: unknown[] };

  // --- export ---
  /**
   * The model is finished and nothing is written yet. The handler may mutate
   * it — splice in a title row, style the header, rename the file — or set
   * `canceled` to stop the run. `fileName` carries no extension; the adapter
   * appends its own, so writing one here is how a host renames the file.
   */
  beforeExport: { format: string; model: ExportTable; fileName: string } & Vetoable;
  /** Rows fetched so far. `total` is absent until a source reports one. */
  exportProgress: { loaded: number; total?: number };
  exported: { format: string; fileName: string; rowCount: number };
  exportFailed: { error: GridLoadError };
  /** The user or the host stopped the export before anything was written. */
  exportCanceled: { format: string };

  // --- other ---
  /** A host that owns its data should reload in response. */
  refreshRequested: Record<string, never>;
  scrolled: { top: number; left: number };
  error: { error: GridLoadError };
}

/** Name of a grid event. */
export type GridEventName = keyof GridEventMap;

/**
 * One event on the aggregate stream, narrowable by `name`.
 *
 * A host binding two or three events binds the granular outputs. A wrapper
 * forwards this one instead, so the line count it owes does not grow as the
 * library gains events. Both carry the same emission.
 *
 * ```ts
 * onGridEvent(event: GridEvent<Booking>): void {
 *   if (event.name === 'selectionChanging' && !this.canSelect()) {
 *     event.payload.canceled = true;
 *   }
 * }
 * ```
 */
export type GridEvent<TRow = unknown> = {
  [K in GridEventName]: { name: K; payload: GridEventMap<TRow>[K] };
}[GridEventName];
