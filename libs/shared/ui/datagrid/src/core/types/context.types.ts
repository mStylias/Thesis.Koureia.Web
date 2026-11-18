/**
 * Typed contexts handed to host renderers.
 *
 * Renderers are recycled during virtualized scrolling: the grid updates the
 * context of an existing instance instead of recreating it. Renderers must
 * not keep per-instance state derived from one row.
 */
import type { GridApi } from './api.types';
import type { ColumnDef } from './column.types';
import type { GridKey } from './key.types';
import type { SummaryConfig } from './config.types';

/** Render state of one cell. */
export interface CellState {
  selected: boolean;
  expanded: boolean;
  editing: boolean;
  focused: boolean;
}

/** Context of a cell renderer. */
export interface CellContext<TRow = unknown> {
  row: TRow;
  key: GridKey;
  /** Absolute index in the dataset, not the rendered index. */
  rowIndex: number;
  column: ColumnDef<TRow>;
  value: unknown;
  displayValue: unknown;
  state: CellState;
  api: GridApi<TRow>;
}

/**
 * What a cell `ng-template` receives. `$implicit` carries the whole context,
 * so `let-cell` binds it in one word and `let-row="row"` still works.
 */
export interface CellTemplateContext<TRow = unknown> extends CellContext<TRow> {
  $implicit: CellContext<TRow>;
}

/** Context of a header cell renderer. */
export interface HeaderContext<TRow = unknown> {
  column: ColumnDef<TRow>;
  api: GridApi<TRow>;
}

/** What a header `ng-template` receives. */
export interface HeaderTemplateContext<TRow = unknown> extends HeaderContext<TRow> {
  $implicit: HeaderContext<TRow>;
}

/** Context of a group row renderer. */
export interface GroupRowContext<TRow = unknown> {
  /** Key path from the root group to this group. */
  path: readonly unknown[];
  /** The grouped column, or `null` when no column declares the grouped field. */
  column: ColumnDef<TRow> | null;
  /** The group's value. */
  value: unknown;
  /** The group's value as the column would display it. */
  displayValue: string;
  /** Nesting depth, `0` for a top-level group. */
  level: number;
  /** Rows inside the group, when known. */
  count?: number;
  aggregates?: Readonly<Record<string, unknown>>;
  expanded: boolean;
  /** Opens the group when it is closed, and closes it when it is open. */
  toggle: () => void;
  api: GridApi<TRow>;
}

/** What a group row `ng-template` receives. */
export interface GroupRowTemplateContext<TRow = unknown> extends GroupRowContext<TRow> {
  $implicit: GroupRowContext<TRow>;
}

/** Context of a detail (expanded row) renderer. */
export interface DetailContext<TRow = unknown> {
  row: TRow;
  key: GridKey;
  /** Closes this detail region. */
  collapse: () => void;
  api: GridApi<TRow>;
}

/** What a detail `ng-template` receives. */
export interface DetailTemplateContext<TRow = unknown> extends DetailContext<TRow> {
  $implicit: DetailContext<TRow>;
}

/** Context of a summary cell renderer. */
export interface SummaryCellContext<TRow = unknown> {
  summary: SummaryConfig;
  value: unknown;
  /** Formatted value per the summary's formats. */
  displayValue: string;
  /** The group the summary covers, or `null` for a grid total. */
  path: readonly unknown[] | null;
  api: GridApi<TRow>;
}

/** What a summary cell `ng-template` receives. */
export interface SummaryCellTemplateContext<TRow = unknown> extends SummaryCellContext<TRow> {
  $implicit: SummaryCellContext<TRow>;
}

/** Context of a custom editor renderer. */
export interface EditorContext<TRow = unknown> {
  value: unknown;
  row: TRow;
  key: GridKey;
  column: ColumnDef<TRow>;
  /** Commit the given value. */
  commit: (value: unknown) => void;
  cancel: () => void;
  api: GridApi<TRow>;
}
