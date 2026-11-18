/** View models the rendered grid consumes. */
import type { TemplateRef, Type } from '@angular/core';
import type { ColumnDef } from './core/types/column.types';
import type { GridKey } from './core/types/key.types';
import type {
  CellTemplateContext,
  DetailTemplateContext,
  GroupRowTemplateContext,
  HeaderTemplateContext,
  SummaryCellTemplateContext,
} from './core/types/context.types';
import type { SortDirection } from './core/sort-cycle.types';
import type { SelectAllState } from './core/selection-range.types';
import type {
  FilterOperator,
  FilterOperatorArity,
  RelativeDateFilter,
} from './core/types/filter.types';
import type { GridEventMap, GridEventName } from './core/types/event.types';
import type { CardTemplateContext } from './core/types/card.types';

/**
 * A component renderer ready for `NgComponentOutlet`.
 *
 * `inputs` holds one key, `context`, so a renderer component declares
 * `readonly context = input.required<CellContext<TRow>>()`. The map keeps a
 * stable identity for as long as the cell's view model does, which is what
 * lets the outlet diff inputs instead of recreating the component — renderers
 * are recycled during virtualized scrolling.
 */
export interface DatagridComponentRenderer {
  type: Type<unknown>;
  inputs: Record<string, unknown>;
}

/** Cell padding scale. Density is a token concern; the row height is not. */
export type DatagridDensity = 'compact' | 'standard' | 'comfortable';

/** Default row height in pixels per density. */
export const DATAGRID_ROW_HEIGHT: Readonly<Record<DatagridDensity, number>> = {
  compact: 36,
  standard: 44,
  comfortable: 52,
};

/**
 * What a cell draws. `'data'` is every host column; the others are the grid's
 * own columns, which render a control instead of a value.
 */
export type DatagridCellKind = 'data' | 'selection' | 'rowNumber' | 'detailToggle';

/** One rendered cell. */
export interface DatagridRenderCell<TRow = unknown> {
  columnId: string;
  kind: DatagridCellKind;
  /** 1-based `aria-colindex`. */
  colIndex: number;
  /** Formatter fast-path text. Empty when a renderer draws the cell. */
  text: string;
  /** Template renderer, or `null` for the fast path or the component branch. */
  template: TemplateRef<CellTemplateContext<TRow>> | null;
  /** Component renderer, or `null`. Never set together with `template`. */
  component: DatagridComponentRenderer | null;
  /** Built only for the renderer path. */
  context: CellTemplateContext<TRow> | null;
  pinned: 'start' | 'end' | false;
  /** True for the innermost pinned column, which carries the divider. */
  edge: boolean;
  /** Sticky inset from the start edge, or `null`. */
  insetStart: number | null;
  /** Sticky inset from the end edge, or `null`. */
  insetEnd: number | null;
  /** Host-contributed classes from `decorateCell`. */
  classes: string | null;
  /** Host-contributed inline styles from `decorateCell`. */
  styles: Readonly<Record<string, string>> | null;
  /** Host-contributed ARIA from `decorateCell`, minus the grid's own attributes. */
  aria: Readonly<Record<string, string>> | null;
  /**
   * Flash parity, or `null` when this cell has never changed. The value
   * alternates on each change and does nothing but pick between two identical
   * keyframes: a CSS animation only restarts when its `animation-name`
   * changes, so re-applying one name would leave a second change unmarked.
   */
  flash: 'a' | 'b' | null;
}

/** One rendered row. */
export interface DatagridRenderRow<TRow = unknown> {
  kind: 'data';
  key: GridKey;
  /** Serialized key, for the `data-key` attribute. */
  keyText: string;
  row: TRow;
  /** Absolute index in the dataset, not the rendered index. */
  index: number;
  /** 1-based `aria-rowindex`, header row included. */
  ariaRowIndex: number;
  /** Offset from the top of the canvas in pixels. */
  top: number;
  height: number;
  /** Group nesting depth, `0` when the grid is not grouped. */
  level: number;
  selected: boolean;
  /** Whether this row's detail region is open. `null` when it has none. */
  expanded: boolean | null;
  cells: DatagridRenderCell<TRow>[];
  /** Host-contributed classes from `decorateRow`. */
  classes: string | null;
  /** Host-contributed inline styles from `decorateRow`. */
  styles: Readonly<Record<string, string>> | null;
  /** Host-contributed ARIA from `decorateRow`, minus the grid's own attributes. */
  aria: Readonly<Record<string, string>> | null;
}

/** One aggregate value drawn inline in a group header. */
export interface DatagridRenderSummary {
  /**
   * Message key naming the aggregate, translated by the view.
   *
   * Not the translated string: a group row is built before the lazy scope has
   * loaded, and `TranslocoService.translate` answers with the key itself until
   * it does. The pipe re-renders when the scope arrives; a value resolved here
   * would stay `datagrid.aggregate.sum` forever.
   */
  labelKey: string;
  text: string;
}

/** One aggregate value drawn in its own column track. */
export interface DatagridRenderSummaryCell<TRow = unknown> {
  columnId: string;
  colIndex: number;
  text: string;
  pinned: 'start' | 'end' | false;
  edge: boolean;
  insetStart: number | null;
  insetEnd: number | null;
  template: TemplateRef<SummaryCellTemplateContext<TRow>> | null;
  component: DatagridComponentRenderer | null;
  context: SummaryCellTemplateContext<TRow> | null;
}

/** One rendered group header row. */
export interface DatagridRenderGroupRow<TRow = unknown> {
  kind: 'group';
  /** Synthetic key that identifies the row in the focus model. */
  key: GridKey;
  keyText: string;
  path: readonly unknown[];
  level: number;
  top: number;
  height: number;
  ariaRowIndex: number;
  expanded: boolean;
  /**
   * Column the label cell reports as its own. A group row carries one cell
   * whichever column the walk arrived from, and this is what a pointer press
   * on it moves the roving focus to.
   */
  columnId: string;
  /** Caption of the grouped column. */
  caption: string;
  /** The group value, formatted by the grouped column. */
  text: string;
  /** Data rows under the group, or `null` when the source did not report it. */
  count: number | null;
  /** Aggregates drawn inline after the label. */
  summaries: readonly DatagridRenderSummary[];
  /**
   * Column-aligned aggregates, or `null` when none is placed under a column.
   * When present the label occupies {@link labelSpan} tracks instead of all.
   */
  cells: readonly DatagridRenderSummaryCell<TRow>[] | null;
  labelSpan: number;
  template: TemplateRef<GroupRowTemplateContext<TRow>> | null;
  component: DatagridComponentRenderer | null;
  context: GroupRowTemplateContext<TRow> | null;
}

/** One rendered group footer row. */
export interface DatagridRenderGroupFooter<TRow = unknown> {
  kind: 'groupFooter';
  key: GridKey;
  keyText: string;
  level: number;
  top: number;
  height: number;
  ariaRowIndex: number;
  cells: readonly DatagridRenderSummaryCell<TRow>[];
}

/** One rendered detail region. */
export interface DatagridRenderDetail<TRow = unknown> {
  kind: 'detail';
  key: GridKey;
  keyText: string;
  top: number;
  height: number;
  ariaRowIndex: number;
  template: TemplateRef<DetailTemplateContext<TRow>> | null;
  component: DatagridComponentRenderer | null;
  context: DetailTemplateContext<TRow> | null;
}

/** Anything the body draws, in render order. */
export type DatagridRenderItem<TRow = unknown> =
  | DatagridRenderRow<TRow>
  | DatagridRenderGroupRow<TRow>
  | DatagridRenderGroupFooter<TRow>
  | DatagridRenderDetail<TRow>;

/**
 * One value drawn on a card.
 *
 * It carries the same `template` / `component` / `context` triple a cell
 * carries, and the context is a `CellContext`: a renderer written for a column
 * draws unchanged in either presentation, which is what makes the card view
 * cost a consumer nothing.
 */
export interface DatagridRenderCardField<TRow = unknown> {
  columnId: string;
  /** The column's caption. Empty when the field draws without one. */
  label: string;
  /** Whether the value stands alone, with the caption reaching screen readers only. */
  hideLabel: boolean;
  /** Whether the entry spans both tracks of the card's field grid. */
  wide: boolean;
  /** Formatter fast-path text. Empty when a renderer draws the value. */
  text: string;
  template: TemplateRef<CellTemplateContext<TRow>> | null;
  component: DatagridComponentRenderer | null;
  context: CellTemplateContext<TRow> | null;
  /** Host-contributed classes from `decorateCell`. */
  classes: string | null;
  /** Host-contributed inline styles from `decorateCell`. */
  styles: Readonly<Record<string, string>> | null;
  /** Host-contributed ARIA from `decorateCell`, minus the grid's own attributes. */
  aria: Readonly<Record<string, string>> | null;
}

/** One rendered card, which is one data row. */
export interface DatagridRenderCard<TRow = unknown> {
  kind: 'card';
  key: GridKey;
  /** Serialized key, for the `data-key` attribute. */
  keyText: string;
  row: TRow;
  /** Absolute index in the dataset, not the rendered index. */
  index: number;
  selected: boolean;
  /** Whether this card's detail region is open. `null` when it has none. */
  expanded: boolean | null;
  title: DatagridRenderCardField<TRow> | null;
  subtitle: DatagridRenderCardField<TRow> | null;
  media: DatagridRenderCardField<TRow> | null;
  meta: readonly DatagridRenderCardField<TRow>[];
  fields: readonly DatagridRenderCardField<TRow>[];
  actions: readonly DatagridRenderCardField<TRow>[];
  /** Whole-card renderer, which replaces every field above. */
  template: TemplateRef<CardTemplateContext<TRow>> | null;
  component: DatagridComponentRenderer | null;
  context: CardTemplateContext<TRow> | null;
  /** Host-contributed classes from `decorateRow`. */
  classes: string | null;
  styles: Readonly<Record<string, string>> | null;
  aria: Readonly<Record<string, string>> | null;
}

/**
 * A group heading in the card list.
 *
 * A real heading rather than a row: cards carry no column tracks, so a group's
 * column-aligned aggregates fold in beside its inline ones.
 */
export interface DatagridRenderCardGroup<TRow = unknown> {
  kind: 'cardGroup';
  key: GridKey;
  keyText: string;
  path: readonly unknown[];
  /** Nesting depth, `0` for a top-level group. */
  level: number;
  expanded: boolean;
  /** Caption of the grouped column. */
  caption: string;
  /** The group value, formatted by the grouped column. */
  text: string;
  /** Data rows under the group, or `null` when the source did not report it. */
  count: number | null;
  summaries: readonly DatagridRenderSummary[];
  template: TemplateRef<GroupRowTemplateContext<TRow>> | null;
  component: DatagridComponentRenderer | null;
  context: GroupRowTemplateContext<TRow> | null;
}

/** One expanded card's detail region, drawn under the card it belongs to. */
export interface DatagridRenderCardDetail<TRow = unknown> {
  kind: 'cardDetail';
  key: GridKey;
  keyText: string;
  template: TemplateRef<DetailTemplateContext<TRow>> | null;
  component: DatagridComponentRenderer | null;
  context: DetailTemplateContext<TRow> | null;
}

/** Anything the card list draws, in render order. */
export type DatagridCardItem<TRow = unknown> =
  | DatagridRenderCard<TRow>
  | DatagridRenderCardGroup<TRow>
  | DatagridRenderCardDetail<TRow>;

/** One rendered header cell. */
export interface DatagridRenderHeaderCell<TRow = unknown> {
  columnId: string;
  kind: DatagridCellKind;
  colIndex: number;
  /** Header caption. Empty for a built-in column, which draws no caption. */
  caption: string;
  /**
   * Message key naming a built-in column, or `null` for a host column, which
   * is named by its caption. A built-in header draws a glyph or a control and
   * would otherwise reach a screen reader unnamed.
   *
   * A key rather than the translated text: a header cell is built before the
   * lazy scope has loaded, and the view's `transloco` pipe re-renders when it
   * arrives.
   */
  labelKey: string | null;
  /** Template renderer, or `null` for the plain caption or the component branch. */
  template: TemplateRef<HeaderTemplateContext<TRow>> | null;
  /** Component renderer, or `null`. Never set together with `template`. */
  component: DatagridComponentRenderer | null;
  context: HeaderTemplateContext<TRow> | null;
  pinned: 'start' | 'end' | false;
  edge: boolean;
  insetStart: number | null;
  insetEnd: number | null;
  /** Current sort direction, or `null` when the column is unsorted. */
  sort: SortDirection | null;
  /** 1-based position among the sort criteria, or `null` when not multi-sorting. */
  sortOrdinal: number | null;
  sortable: boolean;
  resizable: boolean;
  reorderable: boolean;
  hideable: boolean;
  /** Whether the column menu offers grouping by this column. */
  groupable: boolean;
  /** Whether the grid is currently grouped by this column. */
  grouped: boolean;
  /** Whether the header filter popup is offered for this column. */
  filterable: boolean;
  /** Whether a filter is in force on this column. */
  filtered: boolean;
  /** Tri-state of the select-all checkbox. Only meaningful on the selection column. */
  selectAll: SelectAllState;
  /**
   * 0-based header row the cell starts in, which is the number of bands above
   * it. `0` for every column of an unbanded grid.
   */
  row: number;
  /** Header rows the cell occupies, reaching down to the bottom of the header. */
  rowSpan: number;
  /** The band directly above the column, or `null`. */
  parentId: string | null;
}

/** One band cell of a banded header (§5.1). */
export interface DatagridRenderBandCell<TRow = unknown> {
  /** The band's own column id, which is what a reorder names. */
  bandId: string;
  caption: string;
  /** Parent band, or `null` at the top level. A band moves among its siblings. */
  parentId: string | null;
  /** 0-based header row. */
  row: number;
  /** 1-based `aria-colindex` of the first column it covers. */
  colIndex: number;
  /** Columns it covers, which is its `aria-colspan`. */
  colSpan: number;
  pinned: 'start' | 'end' | false;
  edge: boolean;
  insetStart: number | null;
  insetEnd: number | null;
  reorderable: boolean;
  /** Template renderer for the band caption, or `null`. */
  template: TemplateRef<HeaderTemplateContext<TRow>> | null;
  /** Component renderer, or `null`. Never set together with `template`. */
  component: DatagridComponentRenderer | null;
  context: HeaderTemplateContext<TRow> | null;
}

/** One row of band cells. Empty for a grid that declares no column groups. */
export interface DatagridRenderBandRow<TRow = unknown> {
  /** 1-based `aria-rowindex`, which is the row's depth plus one. */
  ariaRowIndex: number;
  cells: readonly DatagridRenderBandCell<TRow>[];
}

/** The editor a filter surface draws for its column. */
export type DatagridFilterEditor = 'none' | 'text' | 'number' | 'date' | 'datetime' | 'boolean';

/** The editor a column's value is edited with. A `time` column falls to text. */
export function filterEditorFor<TRow>(column: ColumnDef<TRow>): DatagridFilterEditor {
  if (column.dataType === 'number') {
    return 'number';
  }
  if (column.dataType === 'boolean') {
    return 'boolean';
  }
  if (column.dataType === 'datetime') {
    return 'datetime';
  }
  return column.dataType === 'date' ? 'date' : 'text';
}

/**
 * One field the filter builder offers.
 *
 * A field, not a column: the builder writes conditions into the free filter
 * tree, which names query fields, and two columns over one field would offer
 * the same condition twice.
 */
export interface DatagridFilterField {
  field: string;
  caption: string;
  editor: DatagridFilterEditor;
  /** Operators the field's operator chooser offers. Never empty. */
  operators: readonly FilterOperator[];
}

/** One cell of the filter row. */
export interface DatagridFilterCell {
  columnId: string;
  colIndex: number;
  caption: string;
  /** `'none'` for a built-in column or one that refuses filtering. */
  editor: DatagridFilterEditor;
  /** Operators the chooser offers. Empty when there is no editor. */
  operators: readonly FilterOperator[];
  op: FilterOperator;
  /** How many values the active operator collects. */
  arity: FilterOperatorArity;
  /** Relative presets the chooser offers. Empty for a non-date column. */
  relativePresets: readonly RelativeDateFilter[];
  /** The relative preset in force, or `null`. */
  relative: RelativeDateFilter | null;
  /** Editor value. A range keeps its upper bound in {@link valueEnd}. */
  value: unknown;
  valueEnd: unknown;
  /**
   * The column carries an expression the row cannot show — a group, a
   * negation, or a condition another surface wrote. §7.3 forbids dropping it
   * silently, so the cell reports it instead of pretending to be empty.
   */
  unsupported: boolean;
  /**
   * The editor holds an edit the query has not seen yet. Only ever true in
   * deferred mode, where the change waits for `Enter`, for the editor to lose
   * focus, or for the apply affordance.
   */
  pending: boolean;
  pinned: 'start' | 'end' | false;
  edge: boolean;
  insetStart: number | null;
  insetEnd: number | null;
}

/** One entry of the header filter's value list. */
export interface DatagridHeaderFilterEntry {
  /** Identity within the list, and what the applied selection names. */
  key: string;
  label: string;
  /** Rows carrying the value among the loaded ones, or `null` for a host option. */
  count: number | null;
  /** True for the entry standing for null and empty values. */
  blank: boolean;
  /** Child periods when the value domain renders as a tree. */
  children?: readonly DatagridHeaderFilterEntry[];
}

/** One line of the filter panel. */
export interface DatagridFilterChip {
  id: string;
  /** Caption of the column, or empty for an entry belonging to none. */
  caption: string;
  /** Message key naming the operator or the relative preset. */
  labelKey: string;
  labelParams: Readonly<Record<string, unknown>>;
  /** Formatted operand, empty when the operator takes none. */
  text: string;
  /** False when the filter row cannot show this entry. */
  representable: boolean;
}

/** One chip in the group panel. */
export interface DatagridGroupChip {
  columnId: string;
  field: string;
  caption: string;
  desc: boolean;
  /** 1-based nesting position, shown so the order is readable. */
  position: number;
}

/** Which replaceable state the grid shows instead of rows. */
export type DatagridStateKind = 'error' | 'empty' | 'noResults' | null;

/**
 * The granular output that carries an event, where one exists. Looked up by
 * name so the aggregate stream and the granular output cannot come apart.
 */
export type GranularOutputs<TRow> = {
  [K in GridEventName]?: (payload: GridEventMap<TRow>[K]) => void;
};

/**
 * What one filter row editor holds. A range keeps its upper bound apart, so
 * emptying one end does not disturb the other.
 */
export interface FilterEditorState {
  op: FilterOperator;
  value: unknown;
  valueEnd: unknown;
}
