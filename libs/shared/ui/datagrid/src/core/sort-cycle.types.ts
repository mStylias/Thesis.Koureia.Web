/** Directions a repeated activation walks through. */
export type SortCycle = 'asc-desc-none' | 'asc-desc';

/** Current direction of a field, or `null` when it is not sorted. */
export type SortDirection = 'asc' | 'desc';

/** How one activation changes the criteria. */
export interface SortToggleOptions {
  /** Keep the other criteria and append this one. Modifier-click sets it. */
  multi?: boolean;
  cycle?: SortCycle;
  /** Direction to apply instead of the next one in the cycle. */
  force?: SortDirection | null;
}
