import type { DatagridRenderBandCell, DatagridRenderHeaderCell } from '../datagrid.types';

/** A resize drag in progress. */
export interface ResizeDrag {
  columnId: string;
  pointerId: number;
  startX: number;
}

/**
 * What a reorder moves: one column, or a whole band with every column under
 * it. The two share the drag entirely — only the id space differs.
 */
export type HeaderUnitKind = 'column' | 'band';

/** A reorder drag in progress. */
export interface ReorderDrag {
  columnId: string;
  kind: HeaderUnitKind;
  /**
   * The header row the grabbed cell sits in, and the band above it. Together
   * they are the drop-target filter: a drag only ever swaps with a cell in the
   * same row under the same band, which is what keeps a leaf inside its band.
   */
  row: number;
  parentId: string | null;
  pointerId: number;
  /** Pointer offset inside the grabbed cell, so the ghost keeps its grip. */
  grabX: number;
  grabY: number;
  caption: string;
  width: number;
  startX: number;
  startY: number;
  /** False until the pointer has moved far enough to be a drag, not a click. */
  active: boolean;
  /**
   * Where the dragged cell sat when the last swap went out, or `null` when no
   * swap is waiting for its render.
   */
  pendingOffset: number | null;
}

/** One cell of a header row: a band caption, or a column. */
export type HeaderRowCell<TRow> =
  | { kind: 'band'; band: DatagridRenderBandCell<TRow>; colIndex: number }
  | { kind: 'column'; column: DatagridRenderHeaderCell<TRow>; colIndex: number };

/** One header row, in column order. */
export interface HeaderRow<TRow> {
  ariaRowIndex: number;
  cells: readonly HeaderRowCell<TRow>[];
}

/** A focusable header cell, as much of it as the arrow keys read. */
export interface NavCell {
  id: string;
  parentId: string | null;
  row: number;
  colIndex: number;
  reorderable: boolean;
}
