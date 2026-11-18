import type { FilterNode } from './types/filter.types';
import type { GridKey } from './types/key.types';

/** Selection interaction mode. */
export type SelectionMode = 'none' | 'single' | 'multiple';

/**
 * Where a range starts and what it must preserve.
 *
 * `rangeBase` is the selection as it stood when the anchor was set. A range
 * is recomputed from it on every shift-click, so repeated shift-clicks from
 * one anchor grow and shrink the range while rows selected before it stay.
 */
export interface AnchorState {
  readonly anchor: GridKey | null;
  readonly rangeBase: ReadonlySet<GridKey> | null;
}

export type InternalSelection =
  | { kind: 'keys'; keys: ReadonlySet<GridKey> }
  | {
      kind: 'allMatching';
      filter: FilterNode | null;
      search: string | null;
      exclusions: ReadonlySet<GridKey>;
    };
