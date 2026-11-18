/** One column of the series table: a series. */
export interface SeriesTableColumn {
  readonly key: string;
  readonly name: string;
}

/** One row of the series table: an axis item and its values, formatted. */
export interface SeriesTableRow {
  readonly key: string;
  readonly label: string;
  readonly cells: readonly string[];
}

/** A series key as its column name. */
export type SeriesNamer = (key: string) => string;
