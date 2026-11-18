/**
 * Which controls fit the toolbar at a given width. No Angular, no DOM.
 *
 * The width is the calendar host's own, measured by the facade, never the
 * viewport's: the side panel changes the calendar's width without changing
 * the window, and the toolbar has to answer that.
 *
 * Controls fold from the right, one threshold each, so the bar loses its
 * least-used control first and the overflow menu appears with the first one
 * folded. The numbers are the starting values; measure them with the Greek
 * labels.
 */
import type { CalendarView } from '../calendar.types';
import type { CalendarToolbarLayout, CalendarToolbarLayoutOptions } from './toolbar-layout.types';

/** Every view, in the order the switcher lists them. */
export const CALENDAR_VIEWS: readonly CalendarView[] = ['day', 'week', 'month', 'year', 'agenda'];

/** Narrows text from a URL or a stored document to a view. */
export function isCalendarView(value: unknown): value is CalendarView {
  return typeof value === 'string' && (CALENDAR_VIEWS as readonly string[]).includes(value);
}

/**
 * Host widths, in CSS pixels, above which a control is drawn inline.
 *
 * Each is the sum of what is still inline at that point, measured with the
 * Greek labels at a 17px root (`calendar.md` has the table), plus 8px. The
 * range label is budgeted at the widest week label: a longer day label gives
 * way to an ellipsis in the few pixels above a threshold.
 */
export const CALENDAR_TOOLBAR_BREAKPOINTS = {
  /** The view switcher draws as buttons above this. */
  viewButtons: 1598,
  /** ...as a select above this, and folds below it. */
  viewSelect: 1389,
  refresh: 1271,
  settings: 1231,
  filters: 1192,
  /** The saved views draw as their strip above this, as the compact field below. */
  viewsCompact: 1080,
  /** The saved views fold below this. */
  viewsMenu: 1052,
  /** The date field folds below this. */
  date: 773,
  /** Today shows its word above this, and only the icon below. */
  todayLabel: 603,
  /** The create button folds below this, last of all, and it floats with the view switch. */
  create: 561,
} as const;

/**
 * What the saved views take from the bar while they are inline: the strip's
 * floor, its two separators and the two gaps they add. A host with no views
 * gives this back to the controls that fold before them.
 */
export const VIEWS_BUDGET = 307;

/** Below this the range label may wrap onto two lines. */
export const COMPACT_RANGE_MAX_WIDTH = 640;

/** Below this the side panel overlays the calendar instead of pushing it. */
export const PANEL_OVERLAY_MAX_WIDTH = 960;

export function toolbarLayout(
  width: number,
  options: CalendarToolbarLayoutOptions = {},
): CalendarToolbarLayout {
  const b = CALENDAR_TOOLBAR_BREAKPOINTS;
  const hasViews = options.views ?? true;
  // Without views, the controls that fold while the views are still inline
  // fold later by the width the views would take. Never later than the
  // controls after them, so the order holds.
  const fits = (threshold: number): boolean =>
    width >= (hasViews ? threshold : Math.max(threshold - VIEWS_BUDGET, b.date));
  const viewSwitch = fits(b.viewButtons) ? 'buttons' : fits(b.viewSelect) ? 'select' : 'menu';
  const views = width >= b.viewsCompact ? 'strip' : width >= b.viewsMenu ? 'compact' : 'menu';
  const layout = {
    todayLabel: width >= b.todayLabel,
    dateInline: width >= b.date,
    views,
    filtersInline: fits(b.filters),
    settingsInline: fits(b.settings),
    refreshInline: fits(b.refresh),
    viewSwitch,
    createInline: width >= b.create,
    floating: width < b.create,
  } as const;
  return {
    ...layout,
    menu:
      (layout.viewSwitch === 'menu' && !layout.floating) ||
      (hasViews && layout.views === 'menu') ||
      !layout.filtersInline ||
      !layout.settingsInline ||
      !layout.refreshInline ||
      !layout.dateInline ||
      (!layout.createInline && !layout.floating),
    compactRange: width < COMPACT_RANGE_MAX_WIDTH,
    panelOverlay: width < PANEL_OVERLAY_MAX_WIDTH,
  };
}
