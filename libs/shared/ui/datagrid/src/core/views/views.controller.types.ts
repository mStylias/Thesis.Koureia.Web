import type { SavedViewsControllerDeps } from '@ui/saved-views/core';
import type { GridTemporaryView } from '../../features.types';
import type { GridState } from '../types/state.types';

/**
 * What the grid's views controller reads and does.
 *
 * The generic controller's deps less the two the grid supplies itself: how to
 * recognise a `GridState` and how to compare two.
 */
export type GridViewsControllerDeps = Omit<
  SavedViewsControllerDeps<GridState>,
  'isState' | 'statesEqual'
> & {
  /** The feature's temporary view, read once by the first load. */
  readonly temporary: () => GridTemporaryView | PromiseLike<GridTemporaryView | null> | null;
};
