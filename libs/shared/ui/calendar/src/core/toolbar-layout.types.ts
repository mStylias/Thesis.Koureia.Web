/** How the saved-views strip is drawn, or where it went. */
export type CalendarViewsPlacement = 'strip' | 'compact' | 'menu';

/** How the view switcher is drawn, or where it went. */
export type CalendarViewSwitchPlacement = 'buttons' | 'select' | 'menu';

/**
 * Which controls the toolbar draws inline at one width. Everything not inline
 * is reachable from the overflow menu.
 */
export interface CalendarToolbarLayout {
  /** The Today button carries its word; below, it is an icon. */
  readonly todayLabel: boolean;
  /** The date field is in the bar; below, it is in the overflow panel. */
  readonly dateInline: boolean;
  readonly views: CalendarViewsPlacement;
  readonly filtersInline: boolean;
  readonly settingsInline: boolean;
  readonly refreshInline: boolean;
  readonly viewSwitch: CalendarViewSwitchPlacement;
  readonly createInline: boolean;
  /**
   * Create and the view switch float in the corner, out of the bar and the overflow panel.
   * Starts where Create folds.
   */
  readonly floating: boolean;
  /** Whether anything folded, which is what draws the overflow menu button. */
  readonly menu: boolean;
  /** The range label may wrap and the date picker narrows. */
  readonly compactRange: boolean;
  /** The side panel slides over the calendar instead of pushing it. */
  readonly panelOverlay: boolean;
}

/** What the host put in the toolbar, where it changes what fits. */
export interface CalendarToolbarLayoutOptions {
  /** Whether the host projected saved views. Defaults to `true`. */
  readonly views?: boolean;
}
