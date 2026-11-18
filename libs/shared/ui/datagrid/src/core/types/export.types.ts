/**
 * Export contract (§15).
 *
 * The grid produces one normalized table model; an adapter turns it into a
 * file format. Nothing here knows about CSV, spreadsheets or the clipboard,
 * which is what lets the same model serve all three and lets a host register
 * a format the library never shipped.
 *
 * The model is **mutable by design**: `beforeExport` hands it to the host so
 * a title row, a logo row or a styled header can be spliced in before a byte
 * is written.
 */
import type { ColumnDataType } from './column.types';
import type { GridKey } from './key.types';

/** How a value is typed in a format that distinguishes types. */
export type ExportValueType =
  | 'string'
  | 'number'
  | 'boolean'
  | 'date'
  | 'datetime'
  | 'time'
  | 'empty';

/**
 * Presentation an adapter may honor. A text format ignores every field; the
 * spreadsheet writer applies all of them.
 */
export interface ExportCellStyle {
  bold?: boolean;
  italic?: boolean;
  /** Background fill as `#RRGGBB`. */
  fill?: string;
  /** Font color as `#RRGGBB`. */
  color?: string;
  /** Font size in points. Default `11`. */
  fontSize?: number;
  align?: 'start' | 'center' | 'end';
  /** Spreadsheet number format, such as `#,##0.00`. Wins over the type default. */
  numberFormat?: string;
  wrap?: boolean;
}

/** Colour family of a drawn tag. The names of the grid's own tag tones. */
export type ExportTone = 'neutral' | 'accent' | 'success' | 'warning' | 'error' | 'info';

/** One tag of a tags visual. */
export interface ExportTag {
  label: string;
  tone: ExportTone;
}

/**
 * What a cell draws besides its text, for a format that draws (§15).
 *
 * A text format ignores it and writes `text`. The PDF writer draws it, so a
 * status tag is a tag on paper too.
 */
export type ExportCellVisual =
  /** Pills, one per tag, wrapped to the column's width. */
  | { kind: 'tags'; tags: ExportTag[] }
  /** A check mark, or a dash when `checked` is `false`. */
  | { kind: 'check'; checked: boolean }
  /** Underlined accent text that opens `href`. `label` replaces the cell's text. */
  | { kind: 'link'; href: string; label: string };

/** One cell of the table. */
export interface ExportCell {
  /** The underlying value, so a spreadsheet writes a number as a number. */
  value: unknown;
  /** The text the grid drew, formatting and lookups already applied. */
  text: string;
  type: ExportValueType;
  /**
   * Columns the cell covers. Cells lie left to right and each consumes
   * `colSpan` columns, so every row of the table is the same width whether it
   * carries one spanning caption or one cell per column.
   */
  colSpan: number;
  /** Group nesting level, drawn as leading indent. `0` elsewhere. */
  indent: number;
  style: ExportCellStyle | null;
  /** What the cell draws, from `ColumnDef.exportVisual`. Absent draws `text`. */
  visual?: ExportCellVisual;
}

/** What one row of the table stands for. */
export type ExportRowKind =
  /** A band caption row, one per band level. */
  | 'band'
  | 'header'
  | 'data'
  /** A group header row. */
  | 'group'
  /** A group's aggregate row. */
  | 'groupFooter'
  /** The grid's total row. */
  | 'summary'
  /** Anything a host spliced in through `beforeExport`. */
  | 'custom';

/** One row of the table. */
export interface ExportRow {
  kind: ExportRowKind;
  cells: ExportCell[];
  /** Group nesting level, `0` outside a group. */
  level: number;
  /** The grid key of a data row. `null` on every other kind. */
  key: GridKey | null;
}

/** One exported column, in the order the grid renders it. */
export interface ExportColumn {
  id: string;
  caption: string;
  dataType: ColumnDataType | undefined;
  /** Rendered width in pixels, which a spreadsheet turns into a column width. */
  width: number;
}

/**
 * The normalized table.
 *
 * Every field is writable: this object is what `beforeExport` receives, and
 * §15 requires the host to be able to insert rows, style headers and change
 * the file name from there.
 */
export interface ExportTable {
  /** The format this table is being written to. */
  format: string;
  /** File name without an extension. The adapter appends its own. */
  fileName: string;
  /** Sheet caption, for a format that names its sheets. */
  sheetName: string;
  columns: ExportColumn[];
  rows: ExportRow[];
}

/** Which rows an export covers. */
export type ExportScope =
  /** Every row matching the current filter, fetched beyond the loaded page. */
  | 'all'
  /** Only the rows the grid has loaded. */
  | 'page'
  /** Only the selected rows. */
  | 'selected';

/** What one export run is asked for. */
export interface ExportOptions {
  scope?: ExportScope;
  /** File name without an extension. Defaults to `ExportConfig.fileName`. */
  fileName?: string;
  sheetName?: string;
  /** Write the header row. Default `true`. */
  headers?: boolean;
  /** Write band caption rows above the header. Default `true`. */
  bands?: boolean;
  /** Write group header and group aggregate rows. Default `true`. */
  groups?: boolean;
  /** Write the grid's total row. Default `true`. */
  summaries?: boolean;
  /** Passed through to the adapter untouched. */
  adapterOptions?: Readonly<Record<string, unknown>>;
}

/**
 * A writer for one format.
 *
 * Registered through `provideDatagridExport`. The library ships `csv` and
 * `tsv`. `provideDatagridExcel()` adds `xlsx` and `provideDatagridPdf()` adds
 * `pdf`, each behind a dynamic import.
 */
export interface ExportAdapter {
  /** Format name, matched against the name passed to `GridApi.export`. */
  format: string;
  /** Appended to the file name. Written without a leading dot. */
  extension: string;
  /** MIME type of the produced blob. */
  mimeType: string;
  write(table: ExportTable, options?: Readonly<Record<string, unknown>>): Blob | Promise<Blob>;
}

/**
 * Where a finished file goes. The default triggers a browser download; a
 * host that uploads instead replaces it through `provideDatagridFileSaver`.
 */
export type DatagridFileSaver = (blob: Blob, fileName: string) => void | Promise<void>;
