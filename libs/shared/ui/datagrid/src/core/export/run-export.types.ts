import type { ExportTableInput } from './build-table.types';
import type { GroupNode } from '../grouping/group-nodes.types';
import type {
  ExportAdapter,
  ExportOptions,
  ExportTable,
  DatagridFileSaver,
} from '../types/export.types';

/** What the grid shell hands one run. */
export interface ExportRunContext<TRow> {
  format: string;
  options: ExportOptions;
  /** Everything the model needs except the rows and the groups. */
  table: Omit<ExportTableInput<TRow>, 'rows' | 'groups' | 'format' | 'options' | 'totalAggregates'>;
  /** Fetches the rows the scope covers, reporting progress as it pages. */
  collect: () => Promise<readonly TRow[]>;
  /** The group tree over the fetched rows, or `null` when the grid is flat. */
  groupsOf: (rows: readonly TRow[]) => readonly GroupNode<TRow>[] | null;
  /** Aggregates of the whole export, for the total row. */
  aggregatesOf: (rows: readonly TRow[]) => Readonly<Record<string, unknown>> | null;
  /** Adapters registered by the host, beneath which the built-ins resolve. */
  adapters: readonly ExportAdapter[];
  /** Runs `beforeExport`. `false` vetoes the run. */
  beforeExport: (table: ExportTable) => boolean;
  save: DatagridFileSaver;
}

/** What one finished run reports back. */
export type ExportOutcome =
  | { status: 'done'; fileName: string; rowCount: number }
  | { status: 'canceled' }
  | { status: 'vetoed' }
  | { status: 'unsupported'; format: string };
