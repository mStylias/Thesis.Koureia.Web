import type { ColumnDef } from './types/column.types';

/** Resolved geometry of one rendered column. */
export interface ColumnLayout<TRow = unknown> {
  column: ColumnDef<TRow>;
  id: string;
  width: number;
  pinned: 'start' | 'end' | false;
  /**
   * Sticky inset in pixels: the distance from the viewport's start edge for
   * a start-pinned column, or from its end edge for an end-pinned one.
   * `null` when the column does not stick.
   */
  inset: number | null;
  /** True for the last start-pinned or first end-pinned column. */
  edge: boolean;
}

/** The full layout the header and body render from. */
export interface GridLayout<TRow = unknown> {
  columns: ColumnLayout<TRow>[];
  /** Sum of the resolved widths. */
  totalWidth: number;
  /** Value for `grid-template-columns`. */
  template: string;
}

/** Sizing inputs of {@link computeColumnLayout}. */
export interface ColumnLayoutOptions {
  /** Inner width of the scroll viewport. `0` when it is not measured yet. */
  containerWidth: number;
  /** Width of a column that declares none, and of an `'auto'` column. */
  defaultWidth: number;
  /** Floor applied to every column that declares no `minWidth`. */
  minWidth: number;
  /**
   * Grow columns to fill a container wider than their total. Columns never
   * shrink below their minimum, so a narrow container scrolls instead of
   * clipping its trailing columns.
   */
  fit: boolean;
}
