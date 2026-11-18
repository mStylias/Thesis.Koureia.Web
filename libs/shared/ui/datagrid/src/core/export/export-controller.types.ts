import type { ColumnDef } from '../types/column.types';
import type { ExportConfig, SummaryConfig } from '../types/config.types';
import type {
  DatagridFileSaver,
  ExportAdapter,
  ExportOptions,
  ExportTable,
} from '../types/export.types';
import type { GridKey } from '../types/key.types';
import type { AggregateSpec, GroupSpec, Query, QueryResult } from '../types/query.types';
import type { SelectionSnapshot } from '../types/api.types';
import type { CustomAggregate } from '../local-engine/aggregate.types';
import type { GridLoadError } from '../types/query.types';

/** Progress of one run, as the export bar shows it. */
export interface ExportProgress {
  format: string;
  loaded: number;
  total: number;
}

/**
 * What one export run reads and reports.
 *
 * The events are named callbacks rather than one `emit`, so the controller
 * cannot reach the rest of the grid's event map — and the shell's typed bus
 * stays the only place event names are written.
 */
export interface ExportControllerDeps<TRow> {
  readonly config: () => ExportConfig | null;
  /**
   * Whether exporting is permitted. `permitted` warns in development when a
   * capability withholds it, and gates the actions a host invokes; `allowed`
   * is the silent read, for the clipboard shortcut a keystroke reaches.
   */
  readonly permitted: () => boolean;
  readonly allowed: () => boolean;
  readonly translate: (key: string, params?: Record<string, unknown>) => string;
  readonly announce: (message: string) => void;
  /** The document the download link and the print frame are created in. */
  readonly document: () => Document;
  readonly adapters: readonly ExportAdapter[];
  readonly fileSaver: DatagridFileSaver | null;

  /** Visible columns in order, minus the ones that refuse to be exported. */
  readonly exportColumns: () => readonly ColumnDef<TRow>[];
  /** Laid-out width per column, so a spreadsheet matches what was on screen. */
  readonly widths: () => ReadonlyMap<string, number>;
  readonly declaredColumns: () => readonly ColumnDef<TRow>[];
  readonly keyOf: () => ((row: TRow) => GridKey) | null;
  readonly gridLabel: () => string;
  readonly booleanLabels: () => { true: string; false: string } | undefined;
  /** IANA zone dates render in. `undefined` is the host environment's. */
  readonly timezone: () => string | undefined;
  /** BCP 47 tag values are formatted in. `undefined` is the host environment's. */
  readonly locale: () => string | undefined;
  /** The raw cell value, which is what a spreadsheet cell carries. */
  readonly cellValue: (row: TRow, column: ColumnDef<TRow>) => unknown;
  readonly cellText: (row: TRow, column: ColumnDef<TRow>) => string;
  /** The display value a renderer receives, which `ColumnDef.exportVisual` reads. */
  readonly cellDisplay: (row: TRow, column: ColumnDef<TRow>) => unknown;
  readonly totalSummaries: () => readonly SummaryConfig[];
  readonly groupSummaries: () => readonly SummaryConfig[];

  readonly loadedRows: () => readonly TRow[];
  readonly rowFor: (key: GridKey) => TRow | undefined;
  readonly selection: () => SelectionSnapshot;
  readonly selectedKeys: () => readonly GridKey[];
  readonly focusedKey: () => GridKey | null;
  readonly effectiveQuery: () => Query;
  readonly fetch: (query: Query, signal: AbortSignal) => Promise<QueryResult<TRow>>;

  readonly groupSpecs: () => readonly GroupSpec[];
  readonly fieldValue: () => (row: TRow, field: string) => unknown;
  readonly aggregateSpecs: (summaries: readonly SummaryConfig[]) => readonly AggregateSpec[];
  readonly customAggregates: () => Readonly<Record<string, CustomAggregate>>;

  readonly onProgress: (loaded: number, total?: number) => void;
  readonly onExported: (format: string, fileName: string, rowCount: number) => void;
  readonly onCanceled: (format: string) => void;
  readonly onFailed: (error: GridLoadError) => void;
  /** Runs `beforeExport`. Returns the file name to use, or `null` to veto. */
  readonly beforeExport: (table: ExportTable) => string | null;
}

/** The options of one call, before the config's defaults are folded in. */
export type ExportCallOptions = ExportOptions | undefined;
