import type { DistinctValue } from '../types/query.types';

/** One formatted entry of a header filter's flat value list. */
export interface DistinctListEntry {
  /** Type-tagged identity, so `1` and `'1'` stay separate. */
  key: string;
  value: unknown;
  /** The value as its column displays it. Empty for a blank. */
  text: string;
  count: number;
  /** True for the entry standing for null and empty values. */
  blank: boolean;
}

/** Options of {@link distinctValues}. */
export interface DistinctValueOptions<TRow> {
  /** The raw value an entry represents. */
  getValue: (row: TRow) => unknown;
  /** Formats the label while retaining the row that supplied the raw value. */
  format: (value: unknown, row: TRow) => string;
}

/** A locally collected value plus one row that supplied it. */
export interface LocalDistinctValue<TRow> extends DistinctValue {
  row: TRow;
}
