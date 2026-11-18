/**
 * Filter contract.
 *
 * One normalized, serializable filter tree is the source of truth. Every
 * filter surface (filter row, header filter, builder, search, programmatic)
 * compiles into this tree.
 *
 * The tree itself is `@ui/data-source`'s, so the same filter a grid builds is
 * the filter a transport binding translates for every other control. What
 * stays here is what only a grid column declares.
 */
import type {
  DataSource,
  DistinctInterval,
  FilterConditionNode,
  FilterGroupNode,
  FilterNode,
  FilterNotNode,
  FilterOperator,
} from '@ui/data-source';

export type { FilterConditionNode, FilterGroupNode, FilterNode, FilterNotNode, FilterOperator };

/** How many values the editor of an operator collects. */
export type FilterOperatorArity = 'none' | 'single' | 'range' | 'list';

/** Time unit of a relative date filter. */
export type RelativeDateUnit = 'minute' | 'hour' | 'day' | 'week' | 'month' | 'year';

/**
 * A date filter stored as a relative descriptor, not a materialized range.
 * The grid re-evaluates it against the current instant on every query,
 * refresh and state restoration.
 */
export interface RelativeDateFilter {
  /**
   * `'last'` looks back from now and `'next'` looks forward.
   *
   * The day-aligned directions count from the start of today, in the grid's time zone, moved
   * by `amount` units: `'on'` is that one unit (`{ on, 0, day }` is today), `'from'` is that
   * start onward with no end, and `'before'` is everything before it.
   */
  direction: RelativeDateDirection;
  /**
   * Number of units. A positive integer for `'last'` and `'next'`. Any integer for the
   * day-aligned directions, where `0` is today and `-1` yesterday.
   */
  amount: number;
  unit: RelativeDateUnit;
}

/** How a relative date filter reads its period. See {@link RelativeDateFilter}. */
export type RelativeDateDirection = 'last' | 'next' | 'on' | 'from' | 'before';

/**
 * One entry of a host-supplied header-filter list.
 *
 * The entry carries its own sub-tree, so a list can offer named ranges and
 * other expressions the distinct values of the column could never produce.
 */
export interface HeaderFilterOption {
  /** Text shown in the list. Host-supplied, so already translated. */
  label: string;
  /** What the entry contributes to the column's filter when it is checked. */
  node: FilterNode;
}

/**
 * A header-filter list read from a source of its own, such as a shop's customers, rather
 * than from the grid's rows.
 *
 * The source searches (its `search` is the popup's search text, sent as typed) and pages
 * ("show more"). A checked entry filters the grid by `field in (values)`.
 */
export interface HeaderFilterSource<TItem = unknown> {
  source: DataSource<TItem>;
  /**
   * What the condition compares. It must be the source's key: a restored filter names values
   * the first page may not hold, and the popup resolves them through `byKeys`.
   *
   * Method syntax on purpose: it lets a `HeaderFilterSource<Customer>` sit in a column that
   * declares `HeaderFilterSource<unknown>`.
   */
  value(item: TItem): unknown;
  /** The entry's text. Already translated. */
  label(item: TItem): string;
  /** The grid field the condition tests. Default: the column's own field. */
  field?: string;
}

/** Per-column filtering options. */
export interface ColumnFilterSpec {
  /** Operators the filter row offers, replacing the data-type defaults. */
  operators?: readonly FilterOperator[];
  /** Operator a fresh filter row cell starts on. Defaults to the first offered. */
  defaultOperator?: FilterOperator;
  /**
   * Relative presets the filter row offers on a date column. Stored as
   * descriptors and re-evaluated per query, never as a materialized range.
   */
  relativePresets?: readonly RelativeDateFilter[];
  /** Fixed header-filter list, instead of the distinct values of the column. */
  headerFilterOptions?: readonly HeaderFilterOption[];
  /** A header-filter list from a source of its own. Wins over {@link headerFilterOptions}. */
  headerFilterSource?: HeaderFilterSource;
  /** Groups numeric values or asks a source for temporal buckets. */
  groupInterval?: DistinctInterval;
  /** Entries the header filter shows before its "show more". */
  headerFilterPageSize?: number;
  /**
   * The filter the column starts with, and what Reset returns it to. It shows in the filter
   * row like one the reader set, so the reader can see it and change it.
   */
  initial?: { relative: RelativeDateFilter };
}
