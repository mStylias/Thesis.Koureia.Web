/**
 * Grid configuration.
 *
 * Structure is declarative configuration; content is host-supplied
 * renderers. The grid never mutates the host's config object, and applies
 * config changes granularly: replacing the object does not reset user state
 * unless the changed keys logically require it.
 */
import type { LucideIconInput } from '@lucide/angular';
import type { CardViewConfig } from './card.types';
import type { ColumnDef, FormatSpec, RendererRef } from './column.types';
import type { FilterNode } from './filter.types';
import type { KeySpec } from './key.types';
import type { AggregateType, DataConfig, DataInput } from './query.types';
import type { ExportScope } from './export.types';
import type { GridTemplates } from './template.types';

/** Row selection behavior. */
export interface SelectionConfig {
  mode: 'none' | 'single' | 'multiple';
  /** When the selection checkbox column shows its checkboxes. */
  checkboxes?: 'none' | 'always' | 'onHover' | 'onLongPress';
  /**
   * What "select all" targets: the loaded page, or every row matching the
   * current filter (exposed as a predicate for remote sources).
   */
  selectAllMode?: 'page' | 'allMatching';
  /** In single mode, re-activating the selected row toggles it off. */
  toggleOnReactivate?: boolean;
  /** What happens to selected keys that vanish on reload. */
  missingKeys?: 'keep' | 'drop';
}

/** Row editing behavior. */
export interface EditingConfig<TRow = unknown> {
  mode: 'none' | 'cell' | 'row' | 'form' | 'popup' | 'batch';
  allowAdd?: boolean;
  allowUpdate?: boolean | ((row: TRow) => boolean);
  allowDelete?: boolean | ((row: TRow) => boolean);
  /** Route delete through the default confirmation. Default `true`. */
  confirmDelete?: boolean;
}

/** Paging behavior. */
export interface PagingConfig {
  mode?: 'pager' | 'infinite' | 'none';
  pageSize?: number;
  /** Page sizes offered by the pager. */
  pageSizes?: readonly number[];
  /**
   * Ask sources for the total count. Off, the pager renders a "load more"
   * affordance instead of a page count.
   */
  requireTotalCount?: boolean;
}

/** Grouping behavior. */
export interface GroupingConfig {
  /** Show the drag-to-group panel. */
  panel?: boolean;
  /** Default expansion of new groups. */
  defaultExpanded?: boolean;
}

/** Row detail expansion. */
export interface DetailConfig {
  /** The detail renderer. Without one no row is expandable. */
  renderer?: RendererRef;
  /** Whether more than one row may be open at a time. Default `'multiple'`. */
  mode?: 'single' | 'multiple';
  /** Height of the detail region in pixels. The virtualizer needs the number. */
  height?: number;
}

/** One total or group aggregate. */
export interface SummaryConfig {
  field: string;
  type: AggregateType;
  /** Local custom aggregate over the cell values. */
  calculate?: (values: readonly unknown[]) => unknown;
  /** Identifier sent to a remote source when `type` is `'custom'`. */
  custom?: string;
  /** `'total'` renders in the footer, `'group'` per group. Default `'total'`. */
  scope?: 'total' | 'group';
  /**
   * Where a group aggregate renders: inline in the group header, in a group
   * footer row under its own column, or under its own column in the group
   * header row. Default `'header'`. Ignored by a `'total'` summary, which
   * always renders in the grid footer under its column.
   */
  placement?: 'header' | 'footer' | 'column';
  /** The column this summary aligns under. Defaults to the column on `field`. */
  columnId?: string;
  valueFormat?: FormatSpec;
  /** Display template. `{0}` is the formatted value. */
  displayFormat?: string;
  /** Renderer for the aligned summary cell, instead of the formatted text. */
  renderer?: RendererRef;
}

/** Filtering surfaces and behavior. The filter tree itself is state, not config. */
export interface FilteringConfig {
  filterRow?: boolean | { apply?: 'auto' | 'deferred' };
  headerFilter?: boolean;
  builder?: boolean;
  panel?: boolean;
  search?: boolean;
  /**
   * Applied to every query, invisible to and unclearable by the user,
   * combined with the user filter via `and`.
   */
  baseFilter?: FilterNode | null;
  /** Mirror changes between filter surfaces. Default `true`. */
  sync?: boolean;
}

/** Built-in toolbar items, referenced by name. */
export type BuiltInToolbarItem =
  | 'columnChooser'
  | 'export'
  | 'refresh'
  | 'autoRefresh'
  | 'clearSelection'
  | 'resetArrangement'
  | 'search'
  | 'filterToggle'
  | 'groupPanel'
  /** Sorting reachable without a header, which is what the card view needs. */
  | 'sortMenu'
  /** Opens the filter builder, instead of the bar that would carry its trigger. */
  | 'filterBuilder'
  /** Switches between the table and the card presentation by hand. */
  | 'viewSwitch'
  /** The named-views strip. Placed automatically when `gridViews()` is on. */
  | 'views';

/**
 * A host-defined toolbar item.
 *
 * `items` alone makes the entry a menu trigger; `items` with `onClick` makes
 * it a split button, whose primary half runs the handler. A `renderer` wins
 * over both and draws whatever the host supplies, in the bar and inside the
 * overflow surface alike.
 */
export interface ToolbarItem {
  id: string;
  location?: 'start' | 'center' | 'end';
  order?: number;
  label?: string;
  /**
   * A shorter caption for the overflow surface, where the item is one row
   * among others rather than a button standing on its own. Absent keeps
   * {@link label} in both places.
   */
  shortLabel?: string;
  /** A Lucide icon component, icon data, or a registered icon name. */
  icon?: LucideIconInput;
  tooltip?: string;
  variant?: 'primary' | 'secondary' | 'ghost';
  disabled?: boolean;
  /**
   * Spins the icon, sets `aria-busy` and blocks a second press. `'reload'`
   * follows the grid's reloads, as the built-in refresh does: the first load
   * does not spin it, but blocks it. Use it for an item that reloads the grid.
   */
  busy?: boolean | 'reload';
  badge?: string | number;
  onClick?: () => void;
  /** Sub-items for menu and split-button items. */
  items?: readonly ToolbarItem[];
  /** Marks a sub-item as the choice in force. Ignored on a top-level item. */
  checked?: boolean;
  /** Arbitrary host renderer for this item. */
  renderer?: RendererRef;
  /** Gate the item on host rules. The grid defines no authorization model. */
  visible?: boolean | (() => boolean);
  /** Whether the item may collapse into the overflow surface. Default `'auto'`. */
  overflow?: 'always' | 'never' | 'auto';
  /** Leaves the item out while the grid draws cards, where the bar has no room for it. */
  hideInCards?: boolean;
  /**
   * Draw the icon alone and move the caption into the tooltip and the
   * accessible name. Overrides {@link ToolbarConfig.iconOnly}. An item with no
   * icon keeps its caption whatever this says, because a button with neither
   * is a blank.
   */
  iconOnly?: boolean;
}

/**
 * A built-in item with the placement overridden.
 *
 * The bare name carries the placement the grid considers natural. Name the
 * item this way to put it in another region, to order it against the rest, or
 * to give it its own icon-only rule.
 */
export interface BuiltInToolbarItemRef {
  name: BuiltInToolbarItem;
  location?: 'start' | 'center' | 'end';
  order?: number;
  overflow?: 'always' | 'never' | 'auto';
  iconOnly?: boolean;
  /** Leaves the item out while the grid draws cards, where the bar has no room for it. */
  hideInCards?: boolean;
}

/** Toolbar composition. */
export interface ToolbarConfig {
  visible?: boolean;
  items?: readonly (BuiltInToolbarItem | BuiltInToolbarItemRef | ToolbarItem)[];
  /**
   * Draw every button as its icon alone, with the caption as the tooltip and
   * the accessible name. A single item overrides it with its own `iconOnly`.
   */
  iconOnly?: boolean;
}

/** Export behavior. Writers are adapters; the grid produces the table model. */
export interface ExportConfig {
  enabled?: boolean;
  /** File name without an extension. The adapter appends its own. */
  fileName?: string;
  /**
   * Formats offered to the user, in the order the toolbar lists them.
   * Adapters resolve by format name. Defaults to `['csv']`, which the library
   * always writes; `'xlsx'` needs `provideDatagridExcel()`.
   */
  formats?: readonly string[];
  /** Sheet caption, for a format that names its sheets. */
  sheetName?: string;
  /** Which rows the toolbar's export covers. Default `'all'`. */
  scope?: ExportScope;
  /**
   * Rows per request while paging through a remote dataset. Default `1000`.
   * Larger is fewer round trips and a coarser progress bar.
   *
   * This is the window the export asks its source for, not the request size on
   * the wire. A source whose endpoint caps the window — an OData endpoint's
   * `MaxTop` is 100 by default — reads it in server-sized pages and answers
   * with the whole window, so a 1000-row window becomes ten requests there. The
   * cost is the source's to know: a grid that asked the transport how to page
   * would have learned about the transport.
   *
   * A source that instead answers **short** truncates the export, because a
   * short page is how a paged fetch recognizes the end of a result. That is a
   * source honoring neither `skip` nor `take`, which the data-source contract
   * requires of it.
   */
  pageSize?: number;
  /**
   * Hard stop on how many rows one export fetches. Default `100_000`. A
   * source that keeps answering with full pages would otherwise page until
   * the browser runs out of memory.
   */
  maxRows?: number;
  /** Write band caption rows above the header. Default `true`. */
  bands?: boolean;
  /** Write group header and group aggregate rows. Default `true`. */
  groups?: boolean;
  /** Write the grid's total row. Default `true`. */
  summaries?: boolean;
  /** Options passed to the adapter untouched. */
  adapterOptions?: Readonly<Record<string, unknown>>;
}

/** Visual toggles and density. All values resolve from design tokens. */
export interface AppearanceConfig {
  density?: 'compact' | 'standard' | 'comfortable';
  outerBorder?: boolean;
  columnSeparators?: boolean;
  rowSeparators?: boolean;
  striping?: boolean;
  hoverHighlight?: boolean;
  wrapText?: boolean;
  wrapHeaderText?: boolean;
  stickyHeader?: boolean;
  stickyFooter?: boolean;
}

/** A class of user action the grid permits, or withholds, at all (§3.3). */
export type GridCapability =
  | 'sorting'
  | 'filtering'
  | 'grouping'
  | 'reordering'
  | 'resizing'
  | 'hiding'
  | 'editing'
  | 'selection'
  | 'paging'
  | 'exporting'
  | 'stateChange';

/**
 * Which classes of user action this grid permits.
 *
 * A capability combines with a column's `allow` by conjunction: an action
 * happens only when the column permits it **and** the capability is not
 * withheld. A withheld capability is refused on every path — pointer, keyboard
 * and imperative API — and its affordances are withheld rather than rendered
 * disabled.
 *
 * The mask is configuration, not user state: it never appears in
 * {@link GridState} and is never persisted.
 */
export interface GridCapabilities extends Partial<Record<GridCapability, boolean>> {
  /**
   * Withholds every capability above. Individual keys re-grant selectively,
   * so a locked view that still sorts is `{ readOnly: true, sorting: true }`.
   *
   * This exists so the same columns and the same config serve a read-only
   * presentation and an interactive one, differing by this key alone.
   */
  readOnly?: boolean;
}

/** Refresh and live-data behavior (§12). */
export interface RefreshConfig {
  /** Whether auto-refresh starts on. */
  auto?: boolean;
  /** Milliseconds between automatic refreshes. Default 30000. */
  interval?: number;
  /** Intervals the indicator offers the user, in milliseconds. */
  intervals?: readonly number[];
  /**
   * Floor on how long a refresh takes before its result reaches the screen,
   * in milliseconds. Default 400. `0` turns it off.
   *
   * A refresh is the one load that can return exactly what is already on
   * screen, so the indicator is the whole of the feedback. An endpoint that
   * answers in 80ms would flash it and change nothing visible. Applies to a
   * refresh alone — a sort or a page change shows its own result.
   */
  minDuration?: number;
}

/** Locale-dependent behavior that is not display formatting. */
export interface LocaleConfig {
  /**
   * Wire format for date/time values exchanged with the data source.
   * Independent of display format. Default `'iso'`.
   */
  dateSerialization?: 'iso' | 'epoch' | ((date: Date) => unknown);
  /** IANA timezone the grid operates in. Default: the host environment's. */
  timezone?: string;
  /**
   * BCP 47 tag numbers, currencies and dates are formatted in, such as `el`. Default: the host
   * environment's, which is the browser's language, not the page's.
   */
  language?: string;
}

/** Classes, styles and ARIA attributes contributed to a row or cell. */
export interface Decoration {
  classes?: readonly string[];
  /** Inline styles, as CSS property names. */
  styles?: Readonly<Record<string, string>>;
  /**
   * ARIA attributes, as attribute names.
   *
   * The attributes naming a position, a state or a role the grid computes are
   * reserved and dropped: `role`, `tabindex`, `aria-colindex`,
   * `aria-rowindex`, `aria-colcount`, `aria-rowcount`, `aria-level`,
   * `aria-expanded` and `aria-selected`. Setting one would describe a table
   * that is not there, for the only users who read them.
   */
  aria?: Readonly<Record<string, string>>;
}

/** The complete grid configuration. */
export interface GridConfig<TRow = unknown> {
  key: KeySpec<TRow>;
  columns: readonly ColumnDef<TRow>[];
  /** An array, a data source, or a full data config with interception hooks. */
  data: DataInput<TRow> | DataConfig<TRow>;
  selection?: SelectionConfig;
  editing?: EditingConfig<TRow>;
  paging?: PagingConfig;
  grouping?: GroupingConfig;
  detail?: DetailConfig;
  summaries?: readonly SummaryConfig[];
  filtering?: FilteringConfig;
  toolbar?: ToolbarConfig;
  /** Host renderers for every slot, as values (§6.1). */
  templates?: GridTemplates;
  export?: ExportConfig;
  appearance?: AppearanceConfig;
  /** The card presentation's behavior (§5.4). */
  cards?: CardViewConfig;
  locale?: LocaleConfig;
  refresh?: RefreshConfig;
  /** Which classes of user action this grid permits at all (§3.3). */
  capabilities?: GridCapabilities;
  /** Decorate a row from its data. Pure, evaluated at render time. */
  decorateRow?: (row: TRow) => Decoration | null;
  /** Decorate a cell from its data. Pure, evaluated at render time. */
  decorateCell?: (row: TRow, columnId: string) => Decoration | null;
}
