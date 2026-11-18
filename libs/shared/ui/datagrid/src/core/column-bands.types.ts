import type { ColumnDef } from './types/column.types';

/** The nesting of a column set, resolved once per set of definitions. */
export interface BandIndex<TRow = unknown> {
  /** Data columns in declaration order, bands flattened away. */
  leaves: readonly ColumnDef<TRow>[];
  /** Band definitions by id, at every depth. */
  bands: ReadonlyMap<string, ColumnDef<TRow>>;
  /**
   * The band ids above each leaf, outermost first. A leaf no band covers is
   * absent, which says the same thing as an empty path and costs nothing.
   */
  pathOf: ReadonlyMap<string, readonly string[]>;
  /** Parent band of each band, so a band reorders among its own siblings. */
  parentOf: ReadonlyMap<string, string | null>;
  /** Header rows the bands need above the leaf row. `0` when none are declared. */
  depth: number;
}

/** One cell of a band row, covering the leaves below it. */
export interface HeaderBandCell {
  /** The band's own column id. */
  id: string;
  caption: string;
  /** Parent band, or `null` at the top level. */
  parentId: string | null;
  /** 0-based header row. */
  row: number;
  /** 1-based `aria-colindex` of the first column it covers. */
  colIndex: number;
  /** Rendered columns it covers, which is its `aria-colspan`. */
  colSpan: number;
  pinned: 'start' | 'end' | false;
  /** Sticky inset, taken from the member that touches the frozen edge. */
  inset: number | null;
  /** True when the band touches the boundary between pinned and scrolling columns. */
  edge: boolean;
  /** Leaf ids under it, in render order. */
  columnIds: readonly string[];
}

/** Where one leaf's header cell sits in the banded header. */
export interface HeaderLeafPlacement {
  /** 0-based header row the cell starts in. */
  row: number;
  /** Header rows it occupies, reaching down to the bottom of the header. */
  rowSpan: number;
  /** The band directly above it, or `null`. */
  parentId: string | null;
}

/** The banded header, derived from the rendered column order. */
export interface HeaderMatrix {
  /** Band rows, outermost first. Empty when no band is declared. */
  bandRows: readonly (readonly HeaderBandCell[])[];
  /** Placement of each leaf's header cell, by column id. */
  leaves: ReadonlyMap<string, HeaderLeafPlacement>;
  /** Header rows in total: the band rows plus the leaf row. */
  rows: number;
}

/** A rendered column, as much of it as the band layout reads. */
export interface BandLayoutEntry {
  id: string;
  pinned: 'start' | 'end' | false;
  inset: number | null;
  edge: boolean;
}
