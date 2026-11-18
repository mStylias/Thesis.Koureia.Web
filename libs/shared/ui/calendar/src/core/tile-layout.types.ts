/** What the packer needs of an event: where it sits in the day. */
export interface TimedItem {
  readonly id: string;
  /** Minutes since midnight, inclusive. */
  readonly start: number;
  /** Minutes since midnight, exclusive. */
  readonly end: number;
}

/** A tile with its place in the column it shares. */
export interface PackedTile {
  readonly id: string;
  /** Minutes, after the minimum height was applied. */
  readonly start: number;
  readonly end: number;
  /** Zero-based column inside the cluster. */
  readonly column: number;
  /** Columns the cluster was split into, so `column / columns` is the tile's left edge. */
  readonly columns: number;
}

/** Events a cluster could not draw, with the span the chip that stands for them covers. */
export interface PackedOverflow {
  readonly start: number;
  readonly end: number;
  readonly ids: readonly string[];
}

export interface PackResult {
  readonly tiles: readonly PackedTile[];
  readonly overflow: readonly PackedOverflow[];
}

export interface PackOptions {
  /** A tile is never shorter than this many minutes, so a point in time still has a body. */
  readonly minMinutes: number;
  /** Past this many side-by-side columns the rest of a cluster becomes one chip. */
  readonly maxColumns: number;
}

/** What a capped list shows: the items that fit and how many it left out. */
export interface FittedList<T> {
  readonly visible: readonly T[];
  readonly hidden: number;
}

/** A run of mutually overlapping events, while the packer is still filling it. */
export interface PackCluster {
  members: PackedTile[];
  /** The end minute of the last event in each column. */
  columnEnds: number[];
  hidden: TimedItem[];
  /** The latest end so far, which decides when the next event opens a new cluster. */
  end: number;
}
