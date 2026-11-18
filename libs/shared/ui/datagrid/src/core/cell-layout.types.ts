import type { Signal } from '@angular/core';

/** What the grid hands {@link DatagridCellLayout}: its own signals, read, never copied. */
export interface CellLayoutSource {
  /** Each rendered column's resolved width, in CSS pixels, by column id. */
  readonly widths: Signal<ReadonlyMap<string, number>>;
  /** Whether the grid draws cards, where a cell has no column width. */
  readonly cards: Signal<boolean>;
  /** The density, which sets the cell padding. */
  readonly density: Signal<string>;
}
