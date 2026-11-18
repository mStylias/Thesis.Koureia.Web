import type { ColumnLayout, GridLayout } from './column-layout.types';
import type { ResolvedRenderer } from './renderer-ref.types';
import type { GridApi } from './types/api.types';
import type { ColumnDef } from './types/column.types';
import type { Decoration, SummaryConfig } from './types/config.types';
import type {
  CellTemplateContext,
  DetailTemplateContext,
  GroupRowTemplateContext,
  SummaryCellTemplateContext,
} from './types/context.types';
import type { GridKey } from './types/key.types';
import type { DatagridRenderRow } from '../datagrid.types';

/** One rendered body entry, before its offset and ARIA index are known. */
export interface RowViewModelItem<TRow> {
  key: GridKey;
  row: TRow;
  dataIndex: number;
  level: number;
  height: number;
}

/** Where a row sits in the canvas and in the ARIA row order. */
export interface RowPlacement {
  top: number;
  ariaRowIndex: number;
}

/**
 * A cached row view model, with everything the builder compares to decide
 * whether it can hand the same object back.
 */
export interface CachedRow<TRow> {
  row: TRow;
  index: number;
  /** Turning the filter row on shifts every body row down by one. */
  ariaRowIndex: number;
  top: number;
  level: number;
  expanded: boolean | null;
  layout: GridLayout<TRow>;
  renderVersion: number;
  focusedColumnId: string | null;
  selected: boolean;
  vm: DatagridRenderRow<TRow>;
  /** Last rendered value per column, for change detection on the flash. */
  values: Map<string, unknown>;
  /**
   * Columns that joined the layout while the loaded rows did not carry their
   * field yet, because the query that fetched those rows did not project it.
   * The value that lands for them next is the column arriving, not an update,
   * so it must not flash.
   */
  arriving: ReadonlySet<string>;
}

/**
 * What the view-model builder reads. Everything is a getter rather than a
 * value, because the builder runs inside the reactive context that renders the
 * body and must see the current arrangement on every pass.
 */
export interface RowViewModelDeps<TRow> {
  readonly api: () => GridApi<TRow>;
  readonly isSelected: (key: GridKey) => boolean;
  readonly isExpanded: (key: GridKey) => boolean;
  readonly cellRenderers: () => ReadonlyMap<string, ResolvedRenderer<CellTemplateContext<TRow>>>;
  readonly groupRenderers: () => ReadonlyMap<
    string,
    ResolvedRenderer<GroupRowTemplateContext<TRow>>
  >;
  readonly summaryRenderers: () => ReadonlyMap<
    string,
    ResolvedRenderer<SummaryCellTemplateContext<TRow>>
  >;
  readonly detailRenderer: () => ResolvedRenderer<DetailTemplateContext<TRow>>;
  /** `null` when the grid declares no detail region, which leaves rows unexpandable. */
  readonly hasDetail: () => boolean;
  readonly decorateRow: () => ((row: TRow) => Decoration | null) | null | undefined;
  readonly decorateCell: () =>
    | ((row: TRow, columnId: string) => Decoration | null)
    | null
    | undefined;
  readonly booleanLabels: () => { true: string; false: string } | undefined;
  /** IANA zone dates render in. `undefined` is the host environment's. */
  readonly timezone: () => string | undefined;
  /** BCP 47 tag values are formatted in. `undefined` is the host environment's. */
  readonly locale: () => string | undefined;
  readonly flashOnChange: () => boolean;
  /** The value a cell shows, after `display`, a lookup and a formatter. */
  readonly displayFor: (row: TRow, column: ColumnDef<TRow>, value: unknown) => unknown;
  readonly columnsByField: () => ReadonlyMap<string, ColumnDef<TRow>>;
  readonly groupSummaries: () => readonly SummaryConfig[];
  readonly groupRowHeight: () => number;
  /** The column a summary aligns under. */
  readonly summaryColumnId: (summary: SummaryConfig) => string;
  readonly toggleGroup: (path: readonly unknown[]) => void;
  readonly collapseRow: (key: GridKey) => void;
}

/** One summary cell's inputs, kept together so the signature stays readable. */
export interface SummaryCellInput<TRow> {
  entry: ColumnLayout<TRow>;
  position: number;
  summary: SummaryConfig | undefined;
  aggregates: Readonly<Record<string, unknown>> | null;
  path: readonly unknown[] | null;
  renderers: ReadonlyMap<string, ResolvedRenderer<SummaryCellTemplateContext<TRow>>>;
}
