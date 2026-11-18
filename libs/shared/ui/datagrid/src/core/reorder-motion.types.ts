/** Where a column sat, with the properties that decide whether the change can play. */
export interface ColumnPlacement {
  offset: number;
  width: number;
  pinned: 'start' | 'end' | false;
}

/**
 * What one column has to play: where its box starts, and how wide it starts.
 *
 * The width belongs here because a FLIP is only continuous while its first
 * frame reproduces the layout the user was looking at. Under `fit` a column
 * leaving re-spreads the container over the survivors, so a survivor's box
 * both travels and grows — playing the travel alone leaves the growth to land
 * on the first frame, which is the jump the motion was meant to hide.
 */
export interface ColumnMotion {
  /** Where the box starts, relative to where it lands. */
  dx: number;
  /** The width it starts at. Equal to `toWidth` when only the place changed. */
  fromWidth: number;
  /** The width it lands on. */
  toWidth: number;
}

/** What each column has to play, once the change is one that can be played at all. */
export interface Rearrangement {
  /** What each moved column has to play, keyed by column id. */
  moves: Map<string, ColumnMotion>;
  /** Ids of the columns that were not there a render ago. */
  arrived: Set<string>;
}
