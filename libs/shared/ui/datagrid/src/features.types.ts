import type { GridState } from './core/types/state.types';
/** Name of an optional surface. */
export type DatagridFeatureName =
  | 'filterRow'
  | 'headerFilter'
  | 'filterPanel'
  | 'filterBuilder'
  | 'groupPanel'
  | 'views';

/** Base of every feature descriptor. */
export interface DatagridFeature<TName extends DatagridFeatureName = DatagridFeatureName> {
  readonly name: TName;
}

/** The inline editor row beneath the header (§7.2). */
export interface FilterRowFeature extends DatagridFeature<'filterRow'> {
  /**
   * `'auto'` filters as the user types, debounced. `'deferred'` waits for
   * `Enter` or for the editor to lose focus, which is what a remote source
   * behind a slow link wants.
   */
  readonly apply: 'auto' | 'deferred';
}

/** The per-column value-list popup (§7.2). */
export interface HeaderFilterFeature extends DatagridFeature<'headerFilter'> {
  /** Entries shown before the list offers "show more". */
  readonly pageSize: number;
}

/** Which edge of the grid a bar sits against. */
export type DatagridBarPosition = 'top' | 'bottom';

/** The readable summary of the active filter, with clear affordances (§7.5). */
export interface FilterPanelFeature extends DatagridFeature<'filterPanel'> {
  /**
   * `'top'` stacks the panel with the other summary bars above the rows.
   * `'bottom'` puts it against the grid's bottom edge, under the pager — where
   * it stays out of the way of a grid whose header area is already crowded.
   */
  readonly position: DatagridBarPosition;
}

/** The full expression editor over the filter tree (§7.2). */
export interface FilterBuilderFeature extends DatagridFeature<'filterBuilder'> {
  /**
   * Which edge the trigger sits against when the filter panel is absent. With
   * the panel on, the trigger is one of its actions and the panel's own edge
   * decides — two bars for one filter would say the same thing twice.
   */
  readonly position: DatagridBarPosition;
}

/** The drag-to-group panel, also reachable through the `groupPanel` input. */
export type GroupPanelFeature = DatagridFeature<'groupPanel'>;

/** The named-views strip (§14.4). */
export interface GridViewsFeature extends DatagridFeature<'views'> {
  /**
   * Names the document this grid's views are stored under. It must identify
   * the grid, not the screen, so two grids on one page keep their own strips.
   */
  readonly key: string;
  /**
   * A view made for this visit, opened instead of the default on the first load. Read once,
   * inside the load the first query waits for, so the grid queries once, in this view.
   *
   * A promise is awaited beside the stored views, so a view that needs a lookup of its own
   * costs no extra round trip.
   */
  readonly temporary?: () => GridTemporaryView | PromiseLike<GridTemporaryView | null> | null;
}

/**
 * A view the host makes for one visit and never stores, such as "this customer's
 * appointments". The strip draws it after the stored views, marked, and nothing can move it,
 * rename it, store it or make it the default.
 */
export interface GridTemporaryView {
  readonly id: string;
  readonly name: string;
  /** Why it exists, for its indicator. Absent reads "Created automatically". */
  readonly description?: string;
  /** Its arrangement, built from the one the grid holds when the view opens. */
  readonly state: (current: GridState) => GridState;
  /** Called once when it stops being the view on screen. See `TemporarySavedView.onLeave`. */
  readonly onLeave?: () => void;
}

/** Maps a name to the descriptor type the factories produce. */
export interface FeatureByName {
  filterRow: FilterRowFeature;
  headerFilter: HeaderFilterFeature;
  filterPanel: FilterPanelFeature;
  filterBuilder: FilterBuilderFeature;
  groupPanel: GroupPanelFeature;
  views: GridViewsFeature;
}
