import type { ColumnDef } from '../types/column.types';
import type { FilterNode, RelativeDateFilter } from '../types/filter.types';

/** Which facet holds an entry, so removing it writes to the right place. */
export type FilterSummarySource = 'column' | 'header' | 'relative' | 'tree' | 'search';

/** One line of the filter panel. */
export interface FilterSummaryEntry {
  /** Identity within the panel, and what a removal names. */
  id: string;
  source: FilterSummarySource;
  /** The column the entry belongs to, or `null` when it maps to none. */
  columnId: string | null;
  /** Caption of that column, the raw field name, or the search label key. */
  caption: string;
  /** Message key naming the operator or the relative preset. */
  labelKey: string;
  /** Interpolation parameters of {@link labelKey}. Empty for most entries. */
  labelParams: Readonly<Record<string, unknown>>;
  /** Formatted value, empty when the operator takes none. */
  text: string;
  /** Whether the filter row can show and edit this entry. */
  representable: boolean;
}

/** A relative descriptor as the query store holds it. */
export interface RelativeFilterEntry {
  field: string;
  filter: RelativeDateFilter;
}

/** Everything the summary reads. Plain data, so it unit-tests without a view. */
export interface FilterSummaryInput<TRow = unknown> {
  columns: readonly ColumnDef<TRow>[];
  /** The slot the filter row owns. */
  columnFilters: ReadonlyMap<string, FilterNode>;
  /**
   * The slot the header filter owns. Listed separately, and removable alone.
   *
   * Optional so a host that built its own panel before the slot existed keeps
   * compiling. Absent means the grid has no header filters, which is what a
   * caller that does not know about them meant.
   */
  headerFilters?: ReadonlyMap<string, FilterNode>;
  relativeFilters: ReadonlyMap<string, RelativeFilterEntry>;
  /** The user filter tree not owned by a single column. */
  tree: FilterNode | null;
  search: string | null;
  /** Renders a value the way its column would display it. */
  formatValue: (value: unknown, column: ColumnDef<TRow> | undefined) => string;
}
