/** A half-open range of row indices: `start` inclusive, `end` exclusive. */
export interface RowWindow {
  start: number;
  end: number;
}

/** Geometry one window computation needs. */
export interface RowWindowOptions {
  scrollTop: number;
  viewportHeight: number;
  rowHeight: number;
  rowCount: number;
  /** Rows rendered beyond each edge, so a scroll step never shows a gap. */
  overscan?: number;
}

/**
 * Where every rendered entry sits on the canvas.
 *
 * Two implementations behind one shape. A body of nothing but data rows is
 * uniform and answers by arithmetic; a body carrying group rows or expanded
 * detail regions answers from a prefix sum built once per item list. The
 * uniform case is the fast path and allocates nothing.
 */
export interface RowOffsets {
  /** Number of entries. */
  readonly count: number;
  /** Height of the whole canvas in pixels. */
  readonly totalHeight: number;
  /** True when every entry is the same height. */
  readonly uniform: boolean;
  /** Pixel offset of an entry from the top of the canvas. */
  offsetOf(index: number): number;
  heightOf(index: number): number;
  /** Index of the entry covering an offset, clamped into range. */
  indexAt(offset: number): number;
}
