/** Fixed values the grid shell reads. Nothing here depends on an instance. */
import type { CardViewConfig, DatagridBreakpoint } from './core/types/card.types';
import type { HeaderLeafPlacement } from './core/column-bands.types';
import type { ToolbarEntry } from './core/toolbar.types';
import type { DatagridCellKind } from './datagrid.types';

/** Stands in for an absent `data`, so the store is never handed a fresh array. */
export const NO_DATA: readonly never[] = [];

/** Shared, so a renderer with no inputs allocates nothing per change detection. */
export const NO_INPUTS: Readonly<Record<string, unknown>> = {};

/**
 * Breathing room added to a measured column width. `scrollWidth` rounds to a
 * whole pixel, and a column sized to exactly its text re-clips the widest cell
 * on any sub-pixel difference.
 */
export const AUTO_SIZE_SLACK = 2;

/** Rows per request while an export pages through a remote dataset. */
export const DEFAULT_EXPORT_PAGE_SIZE = 1000;

/**
 * Rows one export fetches at most. A source that keeps answering with full
 * pages would otherwise page until the browser runs out of memory, and an
 * incomplete file the grid reports is the better failure.
 */
export const DEFAULT_EXPORT_MAX_ROWS = 100_000;

/**
 * Controls a renderer can put inside a cell. `tabindex="-1"` is included and
 * is the normal case here: the body is one tab stop, so a cell's own controls
 * are reachable programmatically rather than by tabbing to them.
 */
export const CELL_WIDGET_SELECTOR =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]';

/**
 * Pixel width of each breakpoint name the card view takes, mirroring
 * `$breakpoints` in `libs/shared/styles/src/abstracts/_scale.scss`.
 *
 * Repeated here rather than read from CSS: `'auto'` resolves in TypeScript
 * through `BreakpointObserver`, and a Sass map is not readable at runtime. The
 * two are kept equal by hand, which is why the source is named.
 */
export const CARD_BREAKPOINTS: Readonly<Record<DatagridBreakpoint, number>> = {
  sm: 640,
  md: 768,
  lg: 1024,
  xl: 1280,
  '2xl': 1536,
};

/**
 * Narrowest a card is drawn before the flow gives it a track of its own. The
 * card list fits as many cards of at least this width as the grid is wide.
 */
export const DEFAULT_CARD_MIN_WIDTH = 280;

/**
 * The column a card's focus position names.
 *
 * A card has no columns, but the focus store holds a `{ key, columnId }` pair
 * and the two views share it — so switching presentation keeps the focused
 * record. The id carries the grid's own namespace, which no host id reaches.
 */
export const CARD_FOCUS_COLUMN = 'lib-datagrid:card';

/** Marks a card's own body, which the shell reads a press on. */
export const CARD_SELECTOR = '[data-card]';

/** Marks the selection checkbox drawn on a card. */
export const CARD_SELECT_SELECTOR = '[data-card-select]';

/** Marks a card's detail expander. */
export const CARD_EXPAND_SELECTOR = '[data-card-expand]';

/**
 * Cards a `PageUp` or `PageDown` moves over.
 *
 * A fixed count, not a measurement: a card declares no height, so the number
 * of them on screen cannot be derived the way the table derives it from the
 * row height. Five is a screen of cards on a phone.
 */
export const CARD_PAGE_STEP = 5;

/**
 * Loaded rows past which an unpaged card view is reported in development. The
 * card list is not virtualized, so every one of them is in the DOM.
 */
export const CARD_UNPAGED_WARNING_ROWS = 200;

/** Stands in for an absent card configuration, so the resolved value is stable. */
export const EMPTY_CARDS: CardViewConfig = {};

/**
 * How far past the last card the auto-load sentinel reaches, in pixels. The
 * next page starts loading while the user is still a screen away from the end,
 * which is what makes the growth invisible rather than a stall at the bottom.
 */
export const AUTO_LOAD_MARGIN = 400;

/** Marks the primary column's activation control, which the shell listens for. */
export const PRIMARY_ACTIVATE_SELECTOR = '[data-primary-activate]';

/** A column no band covers: one header row, starting at the top of it. */
export const UNBANDED_PLACEMENT: HeaderLeafPlacement = { row: 0, rowSpan: 1, parentId: null };

/**
 * The neutral toolbar entry. Every producer spreads this and overrides what it
 * means, so a new field on `ToolbarEntry` needs no edit at each of the three
 * places entries are built.
 */
export const TOOLBAR_ENTRY_BASE = {
  id: '',
  location: 'start',
  order: 0,
  overflow: 'auto',
  elastic: false,
  kind: 'button',
  label: '',
  labelKey: '',
  shortLabel: '',
  shortLabelKey: '',
  tooltip: '',
  icon: null,
  variant: 'secondary',
  iconOnly: false,
  busy: false,
  disabled: false,
  badge: '',
  command: null,
  items: [],
  template: null,
  component: null,
} as const satisfies ToolbarEntry;

/**
 * How long typing settles before the filter reaches the query.
 *
 * The data store coalesces per microtask, which is enough for a paste but not
 * for typing: a remote source would see a request per keystroke.
 */
export const FILTER_APPLY_DELAY = 300;

/**
 * How long the arrangement settles before it is reported and saved.
 *
 * §14.3 asks for a debounce, and the reason is the drag: a resize writes a
 * width per frame, and a state event plus a storage write per frame is a burst
 * from one action.
 */
export const STATE_CHANGE_DELAY = 200;

/** Auto-refresh period when nothing declares one. */
export const DEFAULT_REFRESH_INTERVAL = 30_000;

/**
 * How long a refresh takes at the least, so the indicator that reports it is
 * legible on an endpoint that answers faster than the eye. Long enough to read
 * as an event, short enough not to read as slowness.
 */
export const DEFAULT_REFRESH_MIN_DURATION = 200;

/**
 * Width the pager itself asks for in the footer, in CSS pixels: its four
 * boundary buttons and a five-link window, at the small button size.
 *
 * The footer spends what is left on the page sizes. Above the sum of the two
 * they are drawn as buttons, one press each; below it the row can afford one
 * control, and that is the selector.
 */
export const PAGER_MIN_WIDTH = 340;

/** What one page size costs as a button, in CSS pixels. */
export const PAGE_SIZE_BUTTON_WIDTH = 48;

/**
 * How long the first-load skeleton stays up at minimum, the rows waiting with
 * it. It is drawn from the first frame, so the page never shows an empty grid.
 * A shape that leaves sooner is glimpsed rather than read, and a grid that
 * flashed one for two frames looks like it went wrong rather than like it
 * loaded.
 */
export const SKELETON_MIN_DURATION = 200;

/**
 * Accessible name of each built-in header. Header cells hold a roving tab
 * stop, so every one of them is a place the keyboard can land, and a cell
 * whose only content is a glyph or a presentational control has no name of
 * its own.
 */
export const BUILT_IN_HEADER_LABELS: Readonly<Record<DatagridCellKind, string | null>> = {
  data: null,
  selection: 'datagrid.selection.selectAll',
  rowNumber: 'datagrid.rowNumber.header',
  detailToggle: 'datagrid.detail.header',
};

/** Where the expression editor hangs off the trigger that opened it. */
export const FILTER_BUILDER_POSITIONS = [
  { originX: 'end', originY: 'bottom', overlayX: 'end', overlayY: 'top', offsetY: 4 },
  { originX: 'end', originY: 'top', overlayX: 'end', overlayY: 'bottom', offsetY: -4 },
  { originX: 'start', originY: 'bottom', overlayX: 'start', overlayY: 'top', offsetY: 4 },
  { originX: 'start', originY: 'top', overlayX: 'start', overlayY: 'bottom', offsetY: -4 },
] as const;

/** Where the header filter panel hangs off its column. */
export const HEADER_FILTER_POSITIONS = [
  { originX: 'start', originY: 'bottom', overlayX: 'start', overlayY: 'top', offsetY: 4 },
  { originX: 'start', originY: 'top', overlayX: 'start', overlayY: 'bottom', offsetY: -4 },
  { originX: 'end', originY: 'bottom', overlayX: 'end', overlayY: 'top', offsetY: 4 },
  { originX: 'end', originY: 'top', overlayX: 'end', overlayY: 'bottom', offsetY: -4 },
] as const;
