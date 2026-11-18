/**
 * Column model.
 *
 * Column `id` is the stable identity used in persisted state. Reordering
 * columns or renaming captions does not invalidate state.
 */
import type { TemplateRef, Type } from '@angular/core';
import type { CardColumnSpec } from './card.types';
import type { ExportCellVisual } from './export.types';
import type { ColumnFilterSpec, FilterNode, FilterOperator } from './filter.types';
import type { DataInput } from './query.types';

/**
 * A host renderer: an `ng-template` or a component type.
 *
 * A component type is the branch that survives being passed as a value —
 * it is a symbol another module imports, where a template belongs to the view
 * that declares it. A renderer component receives the slot's context on one
 * input named `context`:
 *
 * ```ts
 * @Component({ selector: 'app-status-cell', template: '{{ context().displayValue }}' })
 * export class StatusCell {
 *   readonly context = input.required<CellContext<Booking>>();
 * }
 * ```
 */
export type RendererRef<TContext = unknown> = TemplateRef<TContext> | Type<unknown>;

/** Data type of a column. Drives default formatting, editors and filter editors. */
export type ColumnDataType = 'string' | 'number' | 'boolean' | 'date' | 'datetime' | 'time';

/** Compares two cell values for local sorting. */
import type { Comparator } from '@ui/data-source';

export type { Comparator };

/** Value formatting: a preset with options, or a plain formatter function. */
export type FormatSpec =
  | { type: 'number' | 'currency' | 'percent'; precision?: number; currency?: string }
  | { type: 'date' | 'datetime' | 'time'; pattern?: string }
  | ((value: unknown) => string);

/**
 * Maps a stored value to a display value from a secondary collection. Used
 * simultaneously for display, the header-filter option list, and the default
 * editor's option list. Resolved entries are cached per grid instance.
 */
export interface LookupSpec<TItem = unknown> {
  source: DataInput<TItem>;
  /** Field name or function producing the stored value of an item. */
  value: string | ((item: TItem) => unknown);
  /** Field name or function producing the display value of an item. */
  display: string | ((item: TItem) => unknown);
}

/** Built-in editor kinds. */
export type EditorType = 'text' | 'number' | 'checkbox' | 'date' | 'datetime' | 'time' | 'select';

/** Editor declaration for a column. */
export interface EditorSpec {
  type?: EditorType;
  /** Editor-specific options, passed through to the editor. */
  options?: Readonly<Record<string, unknown>>;
  /** Custom editor renderer. Wins over `type`. */
  renderer?: RendererRef;
}

/** Per-column feature permissions. Absent means allowed. */
export type ColumnAllow = Partial<
  Record<
    | 'sorting'
    | 'filtering'
    | 'headerFiltering'
    | 'rowFiltering'
    | 'grouping'
    | 'reordering'
    | 'resizing'
    | 'hiding'
    | 'editing'
    | 'exporting',
    boolean
  >
>;

/**
 * The record's own identifier column (§5.1).
 *
 * `true` renders the identifier as a button; a spec with `href` renders a real
 * link instead, so the browser's own "open in a new tab" and "copy link
 * address" work on it.
 */
export interface PrimarySpec<TRow = unknown> {
  href?: (row: TRow) => string;
}

/** Declarative definition of one column. */
export interface ColumnDef<TRow = unknown> {
  /** Stable identity. The key used in persisted state. */
  id: string;

  /**
   * Children, which makes this definition a band rather than a data column
   * (§5.1). A band draws a caption spanning its children in a header row of
   * its own and holds no data; bands nest. Everything below the header — the
   * query, the layout, the body, persisted state — sees only the leaves.
   *
   * ```ts
   * const columns: ColumnDef<Booking>[] = [
   *   { id: 'code', field: 'code' },
   *   {
   *     id: 'customer',
   *     caption: 'Customer',
   *     columns: [
   *       { id: 'name', field: 'customer.name' },
   *       { id: 'phone', field: 'customer.phone' },
   *     ],
   *   },
   * ];
   * ```
   *
   * A band's leaves stay next to each other: the user reorders within a band,
   * and dragging the band's own header cell moves all of its columns together.
   * Pinning any leaf pins the whole band, so a caption never spans a gap.
   */
  columns?: readonly ColumnDef<TRow>[];

  /**
   * Marks this column as the record's identifier (§5.1). At most one column
   * may be primary.
   *
   * The grid pins it, refuses to hide or reorder it, and renders its value as
   * an activation control. Activating it emits `primaryCellActivated` and
   * nothing else — it is not a row activation and does not select the row.
   */
  primary?: boolean | PrimarySpec<TRow>;
  /** Source field. Dot paths reach nested values. */
  field?: string;
  /** Header caption. Falls back to `field`, then `id`. */
  caption?: string;
  dataType?: ColumnDataType;
  format?: FormatSpec;

  /** Initial width in pixels, or `'auto'` to size to content. */
  width?: number | 'auto';
  minWidth?: number;
  maxWidth?: number;
  visible?: boolean;
  /** Initial position among visible columns. */
  visibleIndex?: number;
  pinned?: 'start' | 'end' | false;

  allow?: ColumnAllow;

  /**
   * Initial sort. `index` orders multi-sort criteria. `field` sorts by a
   * different source field than the column displays, which is how a remote
   * source sorts a computed or looked-up column.
   */
  sort?: { order?: 'asc' | 'desc'; index?: number; comparator?: Comparator; field?: string };
  /** Initial grouping. `index` orders group nesting. */
  group?: { index?: number; expanded?: boolean };

  /** Computed value. Wins over `field` for data access. */
  value?: (row: TRow) => unknown;
  /** Computed display value: a field name or a function. */
  display?: string | ((row: TRow) => unknown);
  /** Value used for sorting instead of the cell value. */
  sortValue?: (row: TRow) => unknown;
  /** Builds the filter sub-tree for this column instead of the default condition. */
  filterExpression?: (value: unknown, op: FilterOperator) => FilterNode;
  /** Operators, relative presets and header-filter list of this column. */
  filter?: ColumnFilterSpec;

  /**
   * Extra source fields this column requires beyond `field`, and related
   * entities to expand. Feeds the query projection.
   */
  requires?: { select?: readonly string[]; expand?: readonly string[] };

  lookup?: LookupSpec;

  /**
   * Where this column draws on a card, in the card view (§5.4). Absent
   * resolves: the primary column is the card's title, and every other column
   * is a labelled field row. `{ role: 'none' }` keeps the column in the table
   * and leaves it off the card.
   */
  card?: CardColumnSpec;

  cell?: RendererRef;
  /**
   * What `cell` draws, described for an export format that draws (§15). The
   * presets set it, so a PDF draws a tag as a tag and a check as a check. A
   * host renderer sets it to keep its look in the file. Absent, or `null` for
   * one row, exports the cell's text alone.
   *
   * `value` is the display value, the one a renderer receives.
   */
  exportVisual?: (row: TRow, value: unknown) => ExportCellVisual | null;
  header?: RendererRef;
  /** Renderer for a group header row produced by grouping on this column. */
  groupCell?: RendererRef;
  editor?: EditorSpec;
  tooltip?: string;
  /** Host data, passed through untouched to renderers and events. */
  meta?: Readonly<Record<string, unknown>>;
}
