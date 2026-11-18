import type { FormatOptions } from '../format.types';
import type { GroupNode } from '../grouping/group-nodes.types';
import type { ColumnDef } from '../types/column.types';
import type { SummaryConfig } from '../types/config.types';
import type { ExportOptions } from '../types/export.types';
import type { GridKey } from '../types/key.types';

/** What {@link buildExportTable} is given. */
export interface ExportTableInput<TRow> {
  format: string;
  /** File name without an extension. */
  fileName: string;
  sheetName: string;
  /**
   * Data columns in render order. A column the grid does not show, and one
   * whose `allow.exporting` is `false`, must already be gone.
   */
  columns: readonly ColumnDef<TRow>[];
  rows: readonly TRow[];
  /** Rendered width per column id, which a spreadsheet turns into a width. */
  widths?: ReadonlyMap<string, number>;
  /** Declared column set, so band captions sit above the header. */
  declaredColumns?: readonly ColumnDef<TRow>[];
  /** The group tree, or `null` when the export is flat. */
  groups?: readonly GroupNode<TRow>[] | null;
  keyOf?: (row: TRow) => GridKey;
  /**
   * Reads the exported value of a cell. Defaults to the column's own value
   * pipeline; the grid passes one that also resolves lookups.
   */
  cellValue?: (row: TRow, column: ColumnDef<TRow>) => unknown;
  /** Renders the exported text of a cell. Defaults to the format pipeline. */
  cellText?: (row: TRow, column: ColumnDef<TRow>) => string;
  /**
   * Reads the display value `ColumnDef.exportVisual` receives. Defaults to the
   * column's own display pipeline; the grid passes one that also resolves lookups.
   */
  cellDisplay?: (row: TRow, column: ColumnDef<TRow>) => unknown;
  /** Total summaries, drawn as the last row. */
  totals?: readonly SummaryConfig[];
  /** Group summaries. `'column'` and `'footer'` placements draw their own cells. */
  groupSummaries?: readonly SummaryConfig[];
  /** Aggregates of the whole result, keyed as the local engine keys them. */
  totalAggregates?: Readonly<Record<string, unknown>> | null;
  /** Caption of the total row, when its first column carries no summary. */
  totalsLabel?: string;
  /** Renders one group header. Defaults to `caption: value (count)`. */
  groupLabel?: (node: GroupNode<TRow>, caption: string, value: string) => string;
  formatOptions?: FormatOptions;
  options?: ExportOptions;
}
