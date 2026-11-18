/**
 * `'widen'` grows the grid and leaves the neighbours alone. `'adjacent'`
 * keeps the total width constant by taking the delta out of the next
 * resizable column, which is what a table with no horizontal scroll needs.
 */
export type ResizeMode = 'widen' | 'adjacent';

/** One column's new width. */
export interface ResizedColumn {
  id: string;
  width: number;
}

export interface ResizeOptions {
  /** Floor for a column that declares no `minWidth`. */
  minWidth: number;
  mode: ResizeMode;
}

/** The place a rendered column occupies, as the drag reads it off the header. */
export interface ColumnBox {
  id: string;
  start: number;
  width: number;
  reorderable: boolean;
}
