import type { GridKey } from './types/key.types';

/** A keyboard movement command. */
export type FocusDirection =
  | 'left'
  | 'right'
  | 'up'
  | 'down'
  | 'rowStart'
  | 'rowEnd'
  | 'gridStart'
  | 'gridEnd'
  | 'pageUp'
  | 'pageDown';

/** The grid geometry a movement resolves against. */
export interface FocusContext {
  /** Loaded row keys in render order. */
  keys: readonly GridKey[];
  /** Visible column ids in render order. */
  columnIds: readonly string[];
  /** Rows one page command travels. */
  pageStep: number;
}
