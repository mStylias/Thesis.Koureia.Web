import type { SavedView, SavedViewsDocument, SavedViewsStorage } from '@ui/saved-views/core';
import type { GridState } from '../types/state.types';

/** One saved arrangement of a grid. The page index is not part of it. */
export type GridView = SavedView<GridState>;

/** Every view of one grid, in draw order. The first is the default. */
export type GridViewsDocument = SavedViewsDocument<GridState>;

/** A store of grid view documents. Any `SavedViewsStorage` qualifies. */
export type GridViewsStorage = SavedViewsStorage<GridState>;
