import { NgComponentOutlet, NgTemplateOutlet, isPlatformBrowser } from '@angular/common';
import {
  Component,
  DestroyRef,
  ElementRef,
  Injector,
  afterNextRender,
  afterRenderEffect,
  booleanAttribute,
  computed,
  contentChild,
  contentChildren,
  effect,
  inject,
  input,
  isDevMode,
  model,
  numberAttribute,
  output,
  PLATFORM_ID,
  signal,
  untracked,
  viewChild,
  type OnChanges,
  type Signal,
  type SimpleChanges,
  type TemplateRef,
  type WritableSignal,
} from '@angular/core';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { UiCopyPipe, injectUiCopy } from '@util/ui-copy';
import { LucideRefreshCw } from '@lucide/angular';
import { Button } from '@ui/button';
import { ContextMenu } from '@ui/context-menu';
import type { MenuItem } from '@ui/menu';
import { Paginator, type PaginatorState } from '@ui/paginator';
import { Select, type SelectOption } from '@ui/select';
import { PopoverService, type PopoverComponentRef } from '@ui/popover';
import {
  DETAIL_COLUMN_ID,
  SELECTION_COLUMN_ID,
  detailColumn,
  isBuiltInColumn,
  rowNumberColumn,
  selectionColumn,
} from './core/builtin-columns';
import { ColumnStore, columnField, seedHiddenColumns } from './core/column.store';
import { computeColumnLayout } from './core/column-layout';
import type { GridLayout } from './core/column-layout.types';
import { reorderTarget, resizeColumn } from './core/column-resize';
import type { ResizeMode } from './core/column-resize.types';
import { DataStore, connectDataStore } from './core/data.store';
import { DATAGRID_EXPORT_ADAPTERS, DATAGRID_FILE_SAVER } from './core/export/export-adapters';
import { structurallyEqual } from './core/equality';
import { GridEventBus } from './core/events';
import { ExpansionStore } from './core/expansion.store';
import { FocusStore, moveFocus, reconcileFocus } from './core/focus.store';
import type { FocusDirection } from './core/focus.store.types';
import {
  formatCellText,
  formatGroupValue,
  resolveCellValue,
  resolveDisplayValue,
} from './core/format';
import { createGridApi } from './core/grid-api';
import type { GridApiHost } from './core/grid-api.types';
import { GroupStore } from './core/group.store';
import { buildBodyItems, groupFocusKey } from './core/grouping/body-items';
import type { GridBodyItem } from './core/grouping/body-items.types';
import { buildGroups, groupNodesFromResult, groupPathKey } from './core/grouping/group-nodes';
import type { GroupNode } from './core/grouping/group-nodes.types';
import { createKeyGetter, keyFields, serializeKey } from './core/keys';
import { buildColumnFilter, flattenAnd, readColumnFilter } from './core/filter/column-filter';
import { and, isConditionNode } from './core/filter/filter-node';
import { defaultBuilderCondition } from './core/filter/filter-builder-model';
import type { BuilderConditionBuilder } from './core/filter/filter-builder-model.types';
import { describeFilters } from './core/filter/filter-summary';
import {
  defaultFilterOperator,
  filterOperatorArity,
  filterOperatorsFor,
  relativePresetsFor,
} from './core/filter/operators';
import { DATAGRID_FEATURES, findFeature } from './features';
import type { DatagridBarPosition, DatagridFeature } from './features.types';
import { DATAGRID_DEFAULTS, readConfigLayers } from './datagrid.defaults';
import type { ConfigLayer } from './datagrid.defaults.types';
import { getPath } from './core/paths';
import { noRenderer, resolveRenderer } from './core/renderer-ref';
import type { ResolvedRenderer } from './core/renderer-ref.types';
import { CAPABILITY_OF_ALLOW, resolveCapabilities } from './core/capabilities';
import type { GridCapabilityMask } from './core/capabilities.types';
import { applyRowTransaction } from './core/transactions';
import { LookupStore } from './core/lookup.store';
import { computeHeaderMatrix, indexColumnBands } from './core/column-bands';
import { applyPrimaryRules, primarySpecOf } from './core/primary-column';
import { checkColumnFields } from './presets/columns';
import { DatagridPrimaryCell } from './presets/datagrid-primary-cell';
import { sortToolbarEntries } from './core/toolbar';
import type { ToolbarEntry } from './core/toolbar.types';
import { builtInToolbarEntry, hostToolbarEntry, withIconOnly } from './core/toolbar-entries';
import type { SortMenuColumn, ToolbarEntryDeps } from './core/toolbar-entries.types';
import { SAVED_VIEWS_STORAGE, savedViewsResourceKey } from '@ui/saved-views/core';
import { DATAGRID_STATE_PERSISTENCE } from './core/state-persistence';
import { GridViewsController } from './core/views/views.controller';
import type { GridStatePersistence } from './core/state-persistence.types';
import { applyGridState, gridStatesEqual, serializeGridState } from './core/state';
import type { GridVolatileAccess } from './core/state.types';
import { customAggregatesOf, summariesOfScope, summaryAggregateSpecs } from './core/summaries';
import { normalizePageSize, pageInfo, shouldLoadMore } from './core/paging';
import type { PagingMode } from './core/paging.types';
import { QueryStore } from './core/query.store';
import { ColumnFlip } from './core/reorder-motion';
import { SelectionStore } from './core/selection.store';
import type { SelectionMode } from './core/selection.store.types';
import {
  initialSort,
  sortDirectionOf,
  sortFieldOf,
  sortOrdinalOf,
  sortResolverFor,
  toggleSort,
} from './core/sort-cycle';
import type { SortCycle } from './core/sort-cycle.types';
import { computeWindow, createRowOffsets, offsetToRevealEntry, pageStep } from './core/viewport';
import type { RowOffsets } from './core/viewport.types';
import { AutoLoad } from './core/auto-load';
import { planCardFields } from './core/card-fields';
import type { CardFieldPlan } from './core/card-fields.types';
import { CardViewModels } from './core/card-view-models';
import { ViewMode } from './core/view-mode';
import { DatagridBody } from './body/datagrid-body';
import { DatagridCards } from './cards/datagrid-cards';
import { DatagridFilterPanel } from './filter-panel/datagrid-filter-panel';
import { DatagridFilterRow } from './filter-row/datagrid-filter-row';
import type { DatagridFilterChange } from './filter-row/datagrid-filter-row.types';
import { DatagridFooter } from './footer/datagrid-footer';
import { DatagridGroupPanel } from './group-panel/datagrid-group-panel';
import { DatagridHeader } from './header/datagrid-header';
import type { HeaderUnitKind } from './header/datagrid-header.types';
import { DatagridExportBar } from './export-bar/datagrid-export-bar';
import { DatagridToolbar } from './toolbar/datagrid-toolbar';
import { DATAGRID_TRANSLOCO_SCOPE } from './datagrid.i18n';
import {
  DatagridCardTemplate,
  DatagridCellTemplate,
  DatagridDetailTemplate,
  DatagridEmptyTemplate,
  DatagridErrorTemplate,
  DatagridGroupTemplate,
  DatagridHeaderTemplate,
  DatagridLoadingTemplate,
  DatagridNoResultsTemplate,
  DatagridSummaryTemplate,
  DatagridToolbarTemplate,
} from './datagrid-templates';
import type { DatagridErrorContext } from './datagrid-templates.types';
import {
  DATAGRID_ROW_HEIGHT,
  filterEditorFor,
  type DatagridDensity,
  type DatagridFilterCell,
  type DatagridFilterChip,
  type DatagridFilterField,
  type DatagridGroupChip,
  type DatagridCardItem,
  type DatagridRenderBandRow,
  type DatagridRenderHeaderCell,
  type DatagridRenderItem,
  type DatagridRenderSummaryCell,
  type DatagridStateKind,
  type FilterEditorState,
  type GranularOutputs,
} from './datagrid.types';
import type {
  CellPosition,
  GridApi,
  RowTransaction,
  SelectionSnapshot,
} from './core/types/api.types';
import type {
  CardTemplateContext,
  CardViewConfig,
  DatagridBreakpoint,
  DatagridView,
  ResolvedDatagridView,
} from './core/types/card.types';
import type { ColumnAllow, ColumnDef, RendererRef } from './core/types/column.types';
import type {
  Decoration,
  ExportConfig,
  GridCapabilities,
  GridConfig,
  SummaryConfig,
  BuiltInToolbarItem,
  BuiltInToolbarItemRef,
  ToolbarConfig,
  ToolbarItem,
} from './core/types/config.types';
import type { ExportOptions } from './core/types/export.types';
import type { GridTemplates } from './core/types/template.types';
import type {
  CellTemplateContext,
  DetailTemplateContext,
  GroupRowTemplateContext,
  HeaderContext,
  HeaderTemplateContext,
  SummaryCellTemplateContext,
} from './core/types/context.types';
import type {
  CellPointerEvent,
  ChangeOrigin,
  GridEvent,
  GridEventMap,
  GridEventName,
  RowPointerEvent,
} from './core/types/event.types';
import type { FilterNode, RelativeDateFilter } from './core/types/filter.types';
import type { GridKey, KeySpec } from './core/types/key.types';
import type { CustomAggregate } from './core/local-engine/aggregate.types';
import type {
  DataConfig,
  DataInput,
  GridLoadError,
  GroupSpec,
  Query,
  SortSpec,
} from './core/types/query.types';
import type {
  ApplyStateReport,
  GridState,
  GridStateMigration,
  GridStateOptions,
  GridVolatileState,
} from './core/types/state.types';
import {
  AUTO_SIZE_SLACK,
  BUILT_IN_HEADER_LABELS,
  CARD_EXPAND_SELECTOR,
  CARD_FOCUS_COLUMN,
  CARD_PAGE_STEP,
  CARD_SELECTOR,
  CARD_UNPAGED_WARNING_ROWS,
  CARD_SELECT_SELECTOR,
  CELL_WIDGET_SELECTOR,
  DEFAULT_CARD_MIN_WIDTH,
  DEFAULT_REFRESH_INTERVAL,
  EMPTY_CARDS,
  DEFAULT_REFRESH_MIN_DURATION,
  FILTER_APPLY_DELAY,
  FILTER_BUILDER_POSITIONS,
  NO_DATA,
  PAGER_MIN_WIDTH,
  PAGE_SIZE_BUTTON_WIDTH,
  PRIMARY_ACTIVATE_SELECTOR,
  SKELETON_MIN_DURATION,
  TOOLBAR_ENTRY_BASE,
  UNBANDED_PLACEMENT,
} from './datagrid.constants';
import { headerCellKind, withImplicit } from './datagrid.internals';
import { ExportController } from './core/export/export-controller';
import { GridStateSync } from './core/state-sync';
import { RowViewModels } from './core/row-view-models';
import { HeaderFilterController } from './header-filter/header-filter-controller';
import { DatagridCellLayout } from './core/cell-layout';

/** Whether the host placed a built-in item itself. */
function namesToolbarItem(
  declared: readonly (BuiltInToolbarItem | BuiltInToolbarItemRef | ToolbarItem)[],
  name: BuiltInToolbarItem,
): boolean {
  return declared.some((item) =>
    typeof item === 'string' ? item === name : 'name' in item && item.name === name,
  );
}

/**
 * Virtualized data grid.
 *
 * Rows render only for the visible window, so the work is proportional to the
 * visible cells and not to the dataset. The grid sizes to its container: give
 * it a height through a flex or grid parent rather than a fixed pixel value.
 *
 * ```html
 * <lib-datagrid [columns]="columns" [data]="rows" key="id" ariaLabel="Bookings">
 *   <ng-template libDatagridCell="status" let-cell>
 *     <span class="badge">{{ cell.displayValue }}</span>
 *   </ng-template>
 * </lib-datagrid>
 * ```
 */
@Component({
  selector: 'lib-datagrid',
  templateUrl: './datagrid.html',
  styleUrl: './datagrid.scss',
  imports: [
    NgComponentOutlet,
    NgTemplateOutlet,
    TranslocoPipe,
    UiCopyPipe,
    Button,
    ContextMenu,
    LucideRefreshCw,
    Paginator,
    Select,
    DatagridHeader,
    DatagridBody,
    DatagridCards,
    DatagridFooter,
    DatagridGroupPanel,
    DatagridFilterPanel,
    DatagridFilterRow,
    DatagridExportBar,
    DatagridToolbar,
  ],
  providers: [DATAGRID_TRANSLOCO_SCOPE, DatagridCellLayout],
  host: {
    '[attr.data-view]': 'resolvedView()',
    '[attr.data-density]': 'resolvedDensity()',
    '[attr.data-loading]': 'loading() ? "" : null',
    '[attr.data-empty]': 'stateKind() ? "" : null',
    '[attr.data-error]': 'error() ? "" : null',
    '[attr.data-striped]': 'resolvedStriped() ? "" : null',
    '[attr.data-hover]': 'resolvedHoverHighlight() ? "" : null',
    '[attr.data-row-separators]': 'resolvedRowSeparators() ? "" : null',
    '[attr.data-column-separators]': 'resolvedColumnSeparators() ? "" : null',
    '[attr.data-wrap]': 'resolvedWrapText() ? "" : null',
    '[attr.data-outer-border]': 'resolvedOuterBorder() ? "" : null',
    '[attr.data-selectable]': 'resolvedSelectionMode() !== "none" ? "" : null',
    '[attr.data-read-only]': 'readOnlyMode() ? "" : null',
    '[style.--dg-row-height]': 'rowHeightPx()',
    '[style.--dg-header-height]': 'rowHeightPx()',
    '[style.--dg-header-rows]': 'bandRows()',
    '[style.--dg-template]': 'layout().template',
    '[style.--dg-total-width]': 'totalWidthPx()',
  },
})
export class Datagrid<TRow = unknown> implements OnChanges {
  private readonly injector = inject(Injector);
  private readonly destroyRef = inject(DestroyRef);
  private readonly cellLayout = inject(DatagridCellLayout);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private readonly transloco = inject(TranslocoService);
  private readonly copy = injectUiCopy();
  private readonly hostRef = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly popover = inject(PopoverService);
  private readonly injectedDefaults = inject(DATAGRID_DEFAULTS, { optional: true });
  private readonly injectedPersistence = inject(DATAGRID_STATE_PERSISTENCE, { optional: true });
  private readonly injectedViewsStorage = inject(SAVED_VIEWS_STORAGE, { optional: true });
  /** Host export adapters. The built-in text formats resolve beneath them. */
  private readonly injectedExportAdapters =
    inject(DATAGRID_EXPORT_ADAPTERS, { optional: true }) ?? [];
  private readonly injectedFileSaver = inject(DATAGRID_FILE_SAVER, { optional: true });

  /**
   * The whole configuration as one binding (§19.1).
   *
   * Precedence per key is explicit binding → this object →
   * `provideDatagridDefaults()`. The object is never mutated and is applied
   * granularly, so a host that rebuilds it reactively — a new identity on
   * every dependency change — resets no column width, no scroll offset and no
   * selection as long as the contents are equal.
   *
   * ```ts
   * export const BOOKINGS_GRID: GridConfig<Booking> = { key: 'id', columns: …, data: … };
   * ```
   * ```html
   * <lib-datagrid [config]="config" />
   * <lib-datagrid [config]="config" readOnly />
   * ```
   *
   * Every key is optional: a host that binds `key`, `columns` and `data`
   * separately can send a config that carries only the feature blocks.
   */
  readonly config = input<Partial<GridConfig<TRow>> | null>(null);

  /**
   * Column definitions. Pass a stable reference; a new array reloads layout.
   *
   * Optional: a host computing its columns asynchronously binds them when
   * they arrive and the grid initializes without a remount. Until then it
   * renders the neutral shell — see {@link ready}.
   */
  readonly columns = input<readonly ColumnDef<TRow>[]>([]);

  /** An array, a data source, or a data config with interception hooks. */
  readonly data = input<DataInput<TRow> | DataConfig<TRow> | null>(null);

  /**
   * How a row's identity is derived. Every feature references rows by it, so
   * the grid renders no rows until it has one.
   */
  readonly key = input<KeySpec<TRow> | null>(null);

  /**
   * The user filter tree that no single column owns.
   *
   * Two-way: the filter panel removes entries from it, and `clearFilters()`
   * empties it, so the grid writes back rather than leaving a host binding
   * holding a value the store has already dropped.
   */
  readonly filter = model<FilterNode | null>(null);

  /**
   * Applied to every query, invisible to the user and unclearable by them,
   * combined with the user filter via `and` (§7.3). One-way on purpose: a
   * scope the user cannot see is not a facet the grid may rewrite.
   */
  readonly baseFilter = input<FilterNode | null>(null);

  /**
   * Mirror the free filter tree into the per-column surfaces. Turn it off to
   * keep a host-set scope filter out of the filter row and the filter panel,
   * which is what §7.3 means by disabling synchronization.
   */
  readonly filterSync = input(true, { transform: booleanAttribute });

  /**
   * Optional surfaces, as values. See {@link filterRow},
   * {@link headerFilters}, {@link filterPanel} and {@link groupPanel}.
   * Falls back to `provideDatagridFeatures()` when the host binds nothing.
   */
  readonly features = input<readonly DatagridFeature[]>(
    inject(DATAGRID_FEATURES, { optional: true }) ?? [],
  );

  /** Global search term applied to the query. Two-way, as {@link filter} is. */
  readonly search = model<string | null>(null);

  /**
   * The toolbar: built-in items by name, host items as values, in one list.
   *
   * ```ts
   * protected readonly toolbar: ToolbarConfig = {
   *   items: [
   *     'search',
   *     { id: 'new', label: 'New booking', variant: 'primary', onClick: () => this.create() },
   *     'columnChooser',
   *   ],
   * };
   * ```
   *
   * Items sit in `start` unless they name another region, and collapse into an
   * overflow surface when the bar runs out of room. A `libDatagridToolbar`
   * template is appended to the same list, so the two paths cannot disagree
   * about the order.
   */
  readonly toolbar = input<ToolbarConfig | null>(null);

  /**
   * Host renderers for every slot, as values (§6.1).
   *
   * The path that survives a wrapper: a content query matches by declaration
   * site, so an `ng-template` written inside `<app-grid>` never reaches the
   * grid however many projection hops it takes. Resolution order per slot is
   * the directive on this grid, then this map, then the reference on the
   * `ColumnDef` or the config.
   *
   * ```ts
   * protected readonly templates: GridTemplates = {
   *   cell: { status: StatusCell },
   *   empty: NoBookings,
   * };
   * ```
   */
  readonly templates = input<GridTemplates | null>(null);

  /**
   * Sort criteria, in priority order. Two-way: the header writes here, so a
   * host can persist or preset the sort. Seeded once from the columns'
   * `sort` declarations when the host leaves it empty.
   */
  readonly sort = model<readonly SortSpec[]>([]);

  /** Enables sorting from the header. Per-column `allow.sorting` still applies. */
  readonly sortable = input(true, { transform: booleanAttribute });

  /** Directions a repeated activation walks through. */
  readonly sortCycle = input<SortCycle>('asc-desc-none');

  /** Allows more than one sort criterion via modifier-click and the menu. */
  readonly multiSort = input(true, { transform: booleanAttribute });

  /** Row selection mode. */
  readonly selectionMode = input<SelectionMode>('none');

  /**
   * What the header checkbox selects: the loaded rows, or every row matching
   * the current filter. The second is stored as a predicate, never as a key
   * list, so it stays correct over a remote source of any size.
   */
  readonly selectAllMode = input<'page' | 'allMatching'>('page');

  /** Whether a plain click on a row selects it, or only the checkbox does. */
  readonly selectOnRowClick = input(true, { transform: booleanAttribute });

  /** What happens to selected keys that vanish on reload. */
  readonly missingKeys = input<'keep' | 'drop'>('keep');

  /** In single mode, re-activating the selected row clears it. */
  readonly toggleOnReactivate = input(false, { transform: booleanAttribute });

  /** Selected keys. Empty while the selection is the "all matching" predicate. */
  readonly selectedKeys = model<readonly GridKey[]>([]);

  /**
   * Grouping criteria, outermost level first. Two-way: the group panel and the
   * column menu write here, so a host can preset or persist the grouping.
   */
  readonly group = model<readonly GroupSpec[]>([]);

  /** Shows the drag-to-group panel above the header. */
  readonly groupPanel = input(false, { transform: booleanAttribute });

  /** Offers grouping from the column menu. Per-column `allow.grouping` still applies. */
  readonly groupable = input(true, { transform: booleanAttribute });

  /** Whether a group the user has not touched is open. */
  readonly groupDefaultExpanded = input(true, { transform: booleanAttribute });

  /**
   * Height of a group header or footer row in pixels. `0` follows the data
   * row height. The virtualizer needs the number, so it cannot come from a
   * stylesheet.
   */
  readonly groupRowHeight = input(0, { transform: numberAttribute });

  /**
   * Total and per-group aggregates. A `'total'` summary renders in the grid
   * footer under its column; a `'group'` summary renders where its
   * `placement` says.
   */
  readonly summaries = input<readonly SummaryConfig[]>([]);

  /**
   * Local implementations of the custom aggregates, by identifier. A summary
   * carrying `calculate` registers itself and needs no entry here.
   */
  readonly customAggregates = input<Readonly<Record<string, CustomAggregate>> | null>(null);

  /**
   * Renderer for a row's expanded detail region. Declaring one is what makes
   * rows expandable; the content is instantiated on first expansion.
   */
  readonly detail = input<RendererRef | null>(null);

  /** Whether more than one detail region may be open at a time. */
  readonly detailMode = input<'single' | 'multiple'>('multiple');

  /** Height of a detail region in pixels. The virtualizer needs the number. */
  readonly detailHeight = input(220, { transform: numberAttribute });

  /** Keys of the rows whose detail is open. Two-way, and keyed, so it survives a reload. */
  readonly expandedKeys = model<readonly GridKey[]>([]);

  /**
   * Adds the absolute row number column, correct under paging and
   * virtualization. Two-way: the column menu toggles it as well.
   */
  readonly showRowNumbers = model(false);

  /**
   * How rows are paged. `'none'` loads everything the source returns.
   *
   * `'pager'` becomes `'infinite'` in the card view: a pager under a list of
   * cards spends a row of the content on controls the presentation has no room
   * for, so the cards page by scrolling instead.
   */
  readonly pagingMode = input<PagingMode>('none');

  readonly pageSize = model(50);
  readonly pageIndex = model(0);

  /** Page sizes the pager offers. Empty hides the selector. */
  readonly pageSizes = input<readonly number[]>([]);

  /** Ask the source for a total count. Off, the pager becomes "load more". */
  readonly requireTotalCount = input(true, { transform: booleanAttribute });

  /** How a resize drag redistributes width. */
  readonly resizeMode = input<ResizeMode>('widen');

  readonly allowColumnResize = input(true, { transform: booleanAttribute });
  readonly allowColumnReorder = input(true, { transform: booleanAttribute });

  /**
   * Ids of the columns the user hid. Two-way, so the column chooser and the
   * header menu write to the same place and a host can persist it.
   */
  readonly hiddenColumns = model<readonly string[]>([]);

  /**
   * Send `select`/`expand` derived from the visible columns. Turn off for a
   * source that ignores projection, which would otherwise re-query on every
   * visibility change for nothing.
   */
  readonly projection = input(true, { transform: booleanAttribute });

  /** Cell padding scale. */
  readonly density = input<DatagridDensity>('standard');

  /**
   * Row height in pixels. `0` derives it from {@link density}. The
   * virtualizer computes the window from this number, so it cannot come from
   * a stylesheet.
   */
  readonly rowHeight = input(0, { transform: numberAttribute });

  /** Rows rendered beyond each edge of the viewport. */
  readonly overscan = input(4, { transform: numberAttribute });

  /** Grows columns to fill a container wider than their total width. */
  readonly fitColumns = input(false, { transform: booleanAttribute });

  /** Width of a column that declares none. */
  readonly defaultColumnWidth = input(160, { transform: numberAttribute });

  /** Floor for a column that declares no `minWidth`. */
  readonly minColumnWidth = input(64, { transform: numberAttribute });

  /** Alternating row backgrounds. */
  readonly striped = input(false, { transform: booleanAttribute });

  /** Row highlight under the pointer. */
  readonly hoverHighlight = input(true, { transform: booleanAttribute });

  readonly rowSeparators = input(true, { transform: booleanAttribute });
  readonly columnSeparators = input(false, { transform: booleanAttribute });
  readonly outerBorder = input(true, { transform: booleanAttribute });

  /** Wraps cell text instead of truncating it. */
  readonly wrapText = input(false, { transform: booleanAttribute });

  /**
   * Which presentation the grid draws (§5.4).
   *
   * `'auto'` follows the viewport: below {@link cardsBelow} the same grid
   * draws one card per row instead of a table, because a table of eight
   * columns has no honest form on a phone. The columns, the filter, the sort
   * and the selection are the same in both — only the region between the
   * toolbar and the pager changes.
   *
   * The server and the first client frame always render the table, and
   * `'auto'` flips after the first render. That is what keeps the hydrated
   * DOM identical to the rendered one.
   */
  readonly view = input<DatagridView>('auto');

  /** Breakpoint under which `view="auto"` resolves to cards. Default `'md'`. */
  readonly cardsBelow = input<DatagridBreakpoint>('md');

  /** The card presentation's behavior. */
  readonly cards = input<CardViewConfig | null>(null);

  /**
   * Briefly highlights a cell whose value changed on a refresh, so a live
   * update is visible without the user hunting for it. Only fires for a row
   * that was already on screen with a different value: a first load, a scroll
   * and a re-sort all move values around without changing any of them.
   */
  readonly flashOnChange = input(true, { transform: booleanAttribute });

  /**
   * Slide rows to their new places when a sort reorders them.
   *
   * Only takes effect when the whole dataset is rendered. Under virtualization
   * a sort replaces most of the window outright — measured at 400 rows over a
   * 15-row window, a sort left 3 rows in place and a direction flip left none —
   * so animating would slide two or three rows while a dozen popped, which
   * reads as a fault rather than as motion.
   */
  readonly animateRows = input(true, { transform: booleanAttribute });

  /** Accessible name. Falls back to the translated grid label. */
  readonly ariaLabel = input('');

  /** Ids of elements naming the grid; takes precedence over `ariaLabel`. */
  readonly ariaLabelledby = input('');

  /** Ids of consumer-supplied descriptions. */
  readonly ariaDescribedby = input('');

  /** Contributes classes, styles and ARIA to a row from its data. Pure. */
  readonly decorateRow = input<((row: TRow) => Decoration | null) | null>(null);

  /** Contributes classes, styles and ARIA to a cell from its data. Pure. */
  readonly decorateCell = input<((row: TRow, columnId: string) => Decoration | null) | null>(null);

  /**
   * Labels for boolean columns on the formatter fast path. Without them a
   * boolean prints as `true` / `false`; the localized boolean cell preset
   * ships with the preset milestone.
   */
  readonly booleanLabels = input<{ true: string; false: string } | null>(null);

  /**
   * A host-owned cell the grid writes {@link api} into, and clears on
   * destruction. For a host that cannot reach the instance through a template
   * reference — a grid inside a projected list, or one created dynamically.
   */
  readonly apiRef = input<WritableSignal<GridApi<TRow> | null> | null>(null);

  /**
   * Which classes of user action this grid permits (§3.3).
   *
   * Combined with each column's `allow` by conjunction, and refused on every
   * path — pointer, keyboard and {@link api} — rather than merely hidden.
   */
  readonly capabilities = input<GridCapabilities | null>(null);

  /**
   * Withholds every capability in one binding. Individual keys of
   * {@link capabilities} re-grant selectively, so a locked view that still
   * sorts is `readOnly` plus `[capabilities]="{ sorting: true }"`.
   *
   * This is what lets one config object serve a read-only presentation and an
   * interactive one: the same columns, the same data, one binding apart.
   */
  readonly readOnly = input(false, { transform: booleanAttribute });

  /**
   * The whole arrangement as one two-way binding (§14.1).
   *
   * Subsumes the per-facet models — sort, group, filter, search, hidden
   * columns, page size and the column layout — so a wrapper forwards one
   * binding instead of a dozen. The per-facet models stay for direct
   * consumers, and the two agree: whichever side writes, the other follows.
   *
   * Applying a state issues exactly one data query.
   */
  readonly state = model<GridState | null>(null);

  /**
   * Identity of this grid's saved arrangement. Persistence does nothing
   * without it, which is the default.
   */
  readonly stateKey = input<string | null>(null);

  /**
   * The persistence adapter. Falls back to
   * `provideDatagridStatePersistence()` from an ancestor injector.
   */
  readonly statePersistence = input<GridStatePersistence | null>(null);

  /**
   * Upgrades a persisted state written by an earlier schema version. Without
   * one, a state from another version is discarded rather than misread.
   */
  readonly stateMigration = input<GridStateMigration | null>(null);

  /**
   * Whether auto-refresh is running. Two-way: the indicator toggles it, and a
   * host can drive it from a toolbar of its own.
   */
  readonly autoRefresh = model(false);

  /** Milliseconds between automatic refreshes. Two-way, as the indicator offers a list. */
  readonly autoRefreshInterval = model(DEFAULT_REFRESH_INTERVAL);

  /** Intervals the indicator offers, in milliseconds. Empty hides the chooser. */
  readonly autoRefreshIntervals = input<readonly number[]>([]);

  readonly rowClick = output<RowPointerEvent<TRow>>();
  readonly rowDoubleClick = output<RowPointerEvent<TRow>>();
  readonly rowActivated = output<{ key: GridKey; row: TRow }>();
  readonly cellClick = output<CellPointerEvent<TRow>>();
  readonly cellDoubleClick = output<CellPointerEvent<TRow>>();
  readonly cellFocused = output<CellPosition>();
  /**
   * The primary column's cell was activated (§5.1): the record's identifier
   * was clicked, or `Enter` was pressed over it. Distinct from `rowActivated`,
   * which neither fires alongside it nor is replaced by it.
   */
  readonly primaryCellActivated = output<{ key: GridKey; row: TRow }>();
  /**
   * The selection the grid is about to apply. Set `canceled` to refuse it.
   * Emission is synchronous, so the veto is read the moment the handler
   * returns — which is what lets it survive being re-emitted by a wrapper.
   */
  readonly selectionChanging = output<{ proposed: SelectionSnapshot; canceled: boolean }>();
  readonly selectionChanged = output<SelectionSnapshot>();
  readonly groupChanged = output<readonly GroupSpec[]>();
  /** The detail region the grid is about to open. Set `canceled` to refuse it. */
  readonly rowExpanding = output<{ key: GridKey; canceled: boolean }>();
  readonly rowExpanded = output<{ key: GridKey }>();
  /** The detail region the grid is about to close. Set `canceled` to refuse it. */
  readonly rowCollapsing = output<{ key: GridKey; canceled: boolean }>();
  readonly rowCollapsed = output<{ key: GridKey }>();
  readonly scrolled = output<{ top: number; left: number }>();
  readonly loadFailed = output<GridLoadError>();
  /** The default no-results state asks the host to clear its own filters. */
  readonly clearFilters = output();
  /**
   * The arrangement changed. Debounced, so a drag or a burst of typing
   * reports once, and marked with where the change came from: `'user'` for an
   * interaction, `'programmatic'` for a `setState`, a `[state]` write or a
   * restored arrangement.
   */
  readonly stateChanged = output<{ state: GridState; origin: ChangeOrigin }>();
  /**
   * The grid is about to re-run its query — from {@link reload}, from the
   * refresh affordance, or from an auto-refresh tick. A host that owns its
   * own data responds to this.
   */
  readonly refreshRequested = output();

  /**
   * Every event on one stream, narrowable by `name`.
   *
   * Bind the granular outputs for two or three events; bind this one to
   * forward all of them, which is what a wrapper does. Both carry the same
   * emission, so a handler here sees a cancellable payload before the grid
   * reads the veto.
   */
  readonly gridEvent = output<GridEvent<TRow>>();

  private readonly cellTemplateQuery =
    contentChildren<DatagridCellTemplate<TRow>>(DatagridCellTemplate);
  private readonly headerTemplateQuery =
    contentChildren<DatagridHeaderTemplate<TRow>>(DatagridHeaderTemplate);
  private readonly groupTemplateQuery =
    contentChildren<DatagridGroupTemplate<TRow>>(DatagridGroupTemplate);
  private readonly summaryTemplateQuery =
    contentChildren<DatagridSummaryTemplate<TRow>>(DatagridSummaryTemplate);
  private readonly detailTemplate =
    contentChild<DatagridDetailTemplate<TRow>>(DatagridDetailTemplate);
  private readonly cardTemplate = contentChild<DatagridCardTemplate<TRow>>(DatagridCardTemplate);
  private readonly toolbarTemplateQuery = contentChildren(DatagridToolbarTemplate);
  protected readonly emptyTemplate = contentChild(DatagridEmptyTemplate);
  protected readonly noResultsTemplate = contentChild(DatagridNoResultsTemplate);
  protected readonly errorTemplate = contentChild(DatagridErrorTemplate);
  protected readonly loadingTemplate = contentChild(DatagridLoadingTemplate);

  private readonly viewportRef = viewChild<ElementRef<HTMLElement>>('viewport');
  private readonly headerRef = viewChild<DatagridHeader<TRow>>(DatagridHeader);
  // `read: ElementRef` is not optional here: a template reference on a
  // component element resolves to the component instance by default, and the
  // panel's whereabouts are what this query exists for.
  private readonly groupPanelRef = viewChild<unknown, ElementRef<HTMLElement>>('groupPanel', {
    read: ElementRef,
  });
  private readonly refreshMenuRef = viewChild<ContextMenu>('refreshMenu');

  /** Watched by {@link AutoLoad}; absent whenever there is no next page. */
  private readonly loadSentinelRef = viewChild<unknown, ElementRef<HTMLElement>>('loadSentinel', {
    read: ElementRef,
  });

  /** Intervals the refresh indicator offers, built at open time. */
  protected readonly refreshMenuItems = signal<readonly MenuItem[]>([]);

  private readonly columnStore = new ColumnStore<TRow>();
  private readonly queryStore = new QueryStore();
  private readonly dataStore = new DataStore<TRow>([]);
  private readonly selectionStore = new SelectionStore();
  private readonly groupStore = new GroupStore();
  private readonly expansionStore = new ExpansionStore();
  protected readonly focusStore = new FocusStore();
  /** Resolved lookup collections, one per grid instance, never per row (§5.3). */
  private readonly lookupStore = new LookupStore();

  private readonly scrollTop = signal(0);
  private readonly scrollLeft = signal(0);
  private readonly viewportHeight = signal(0);
  private readonly viewportWidth = signal(0);
  private readonly announcement = signal<string | null>(null);
  /** Forces a rebuild that no input change would produce. See `repaint()`. */
  private readonly renderTick = signal(0);

  /** The focus request already applied to the DOM. See the effect that reads it. */
  private appliedFocusRequest = 0;
  private previousKeys: readonly GridKey[] = [];
  private sortSeeded = false;
  private filtersSeeded = false;
  /** The `select` the loaded rows were fetched with. `null` is every field. */
  private readonly loadedSelect = signal<readonly string[] | null>(null);

  /**
   * Whether a load brings only the projected fields. An array, and a source the grid runs
   * locally over (`remote: false`), hold every field whatever the projection says.
   */
  private projectsLoads(): boolean {
    const data = this.resolvedData();
    if (!this.projection() || data == null || Array.isArray(data)) {
      return false;
    }
    if ('source' in data) {
      return !Array.isArray(data.source) && data.remote !== false;
    }
    return true;
  }
  private announcedCount: number | null = null;
  private destroyed = false;
  private settledOnce = false;
  private hiddenSeeded = false;
  private lastHidden: ReadonlySet<string> = new Set();
  /** What each column last declared for `visible`, so a change is followed. */
  private readonly declaredVisibility = new Map<string, boolean>();
  /** Columns already warned about for an unresolvable field, so it says it once. */
  private readonly reportedFields = new Set<string>();
  /** Columns already warned about for declaring a second primary column. */
  private readonly reportedPrimary = new Set<string>();
  /** Scroll requested before the viewport existed, applied on first render. */
  private pendingScroll: { top: number; left: number } | null = null;
  /** Widths written by drag frames, reported once the drag lets go. */
  private readonly pendingResize = new Map<string, number | 'auto'>();
  /** The position a reorder drag has reached, reported once it lets go. */
  private pendingMove: { columnId: string; visibleIndex: number } | null = null;
  /** True while a header drag hovers the group panel, which then claims the drop. */
  protected readonly groupDropActive = signal(false);
  /** The column an active header drag holds, read when the drop lands on the panel. */
  private dragColumnId: string | null = null;
  /**
   * The floating copy of the dragged header, in this host's coordinate space.
   * Drawn here rather than in the header because the header sits inside the
   * scroll viewport, which clips anything leaving the header row.
   */
  protected readonly dragGhost = signal<{
    caption: string;
    width: number;
    left: number;
    top: number;
  } | null>(null);
  /** The pointer's offset inside the grabbed cell, so the ghost keeps its grip. */
  private dragGrab = { x: 0, y: 0 };
  /** Plays a column to its new slot when a drag swaps it. */
  private readonly columnFlip = new ColumnFlip();

  /**
   * What each filter row editor holds, which is a facet of its own.
   *
   * The node in the query store is derived from it, not the other way round: a
   * date column filtered for one day stores a `between` over that day's
   * instants, and re-deriving the editor from the node would flip the operator
   * chooser from "equals" to "between" the moment the user picked a date.
   */
  private readonly filterEditors = signal<ReadonlyMap<string, FilterEditorState>>(new Map());

  /**
   * Columns whose editor is waiting for the debounce or for a commit.
   *
   * A signal rather than a plain set: the filter row marks a pending cell, so
   * deferred apply says that a change is waiting instead of leaving the user
   * to guess whether anything happened.
   */
  private readonly pendingFilters = signal<ReadonlySet<string>>(new Set());
  private filterTimer: ReturnType<typeof setTimeout> | null = null;

  /** The per-column value-list popup, which owns its own overlay and entries. */
  private readonly headerFilter = new HeaderFilterController<TRow>({
    injector: this.injector,
    popover: this.popover,
    translate: (key, params) => this.translate(key, params),
    columnById: (columnId) => this.columnById(columnId),
    pageSize: () => this.headerFilterFeature()?.pageSize ?? 50,
    dataRows: () => this.dataRows(),
    formatValue: () => this.formatFilterValue(),
    displayOf: (columnId, value) => this.lookupStore.displayOf(columnId, value),
    loadDistinct: (request) => this.dataStore.loadDistinct(request),
    loadValueBounds: (field, signal) => this.dataStore.loadValueBounds(field, signal),
    cancelDistinctLoad: () => {
      this.dataStore.cancelDistinctLoad();
    },
    headerFilterOf: (columnId) => this.queryStore.headerFilters().get(columnId) ?? null,
    setHeaderFilter: (columnId, node) => {
      this.queryStore.setHeaderFilter(columnId, node);
    },
    setOpen: (open) => {
      this.headerFilterOpen.set(open);
    },
    isDestroyed: () => this.destroyed,
    refocusColumn: (columnId) => {
      this.headerRef()?.refocusColumn(columnId);
    },
    announceApplied: (columnId) => {
      this.announceFilter(columnId);
    },
    announceCleared: (columnId) => {
      this.announceFilterCleared(columnId);
    },
  });

  private readonly events = new GridEventBus<TRow>();

  private readonly granular: GranularOutputs<TRow> = {
    rowClick: (payload) => {
      this.rowClick.emit(payload);
    },
    rowDoubleClick: (payload) => {
      this.rowDoubleClick.emit(payload);
    },
    rowActivated: (payload) => {
      this.rowActivated.emit(payload);
    },
    cellClick: (payload) => {
      this.cellClick.emit(payload);
    },
    primaryCellActivated: (payload) => {
      this.primaryCellActivated.emit(payload);
    },
    cellDoubleClick: (payload) => {
      this.cellDoubleClick.emit(payload);
    },
    cellFocused: (payload) => {
      this.cellFocused.emit(payload);
    },
    selectionChanging: (payload) => {
      this.selectionChanging.emit(payload);
    },
    selectionChanged: (payload) => {
      this.selectionChanged.emit(payload.selection);
    },
    groupChanged: (payload) => {
      this.groupChanged.emit(payload.group);
    },
    rowExpanding: (payload) => {
      this.rowExpanding.emit(payload);
    },
    rowExpanded: (payload) => {
      this.rowExpanded.emit(payload);
    },
    rowCollapsing: (payload) => {
      this.rowCollapsing.emit(payload);
    },
    rowCollapsed: (payload) => {
      this.rowCollapsed.emit(payload);
    },
    scrolled: (payload) => {
      this.scrolled.emit(payload);
    },
    loadFailed: (payload) => {
      this.loadFailed.emit(payload.error);
    },
    stateChanged: (payload) => {
      this.stateChanged.emit(payload);
    },
    refreshRequested: () => {
      this.refreshRequested.emit();
    },
  };

  private readonly gridApi = createGridApi<TRow>(this.apiHost(), () => this.destroyed);

  /**
   * The imperative API, as one value.
   *
   * ```ts
   * private readonly grid = viewChild.required(Datagrid);
   * readonly api = computed(() => this.grid().api());
   * ```
   *
   * That line is the whole of what a wrapper owes, and it does not grow when
   * the API does. Methods whose feature has not shipped throw.
   */
  readonly api: Signal<GridApi<TRow>> = computed(() => this.gridApi);

  /** Builds what the body draws, and owns the row cache that makes it cheap. */
  private readonly rowViewModels = new RowViewModels<TRow>({
    api: () => this.gridApi,
    isSelected: (key) => this.selectionStore.isSelected(key),
    isExpanded: (key) => this.expansionStore.isExpanded(key),
    hasDetail: () => this.detailRenderer() != null,
    cellRenderers: () => this.cellRenderers(),
    groupRenderers: () => this.groupRenderers(),
    summaryRenderers: () => this.summaryRenderers(),
    detailRenderer: () => this.resolvedDetail(),
    decorateRow: () => this.resolvedDecorateRow(),
    decorateCell: () => this.resolvedDecorateCell(),
    booleanLabels: () => this.resolvedBooleanLabels(),
    timezone: () => this.resolvedTimezone(),
    locale: () => this.resolvedLanguage(),
    flashOnChange: () => this.flashOnChange(),
    displayFor: (row, column, value) => this.displayFor(row, column, value),
    columnsByField: () => this.columnsByField(),
    groupSummaries: () => this.groupSummaries(),
    groupRowHeight: () => this.resolvedGroupRowHeight(),
    summaryColumnId: (summary) => this.summaryColumnId(summary),
    toggleGroup: (path) => {
      this.toggleGroup(path);
    },
    collapseRow: (key) => {
      this.setRowExpanded(key, false);
    },
  });

  /**
   * Builds the cards. It shares every dep the rows use — the resolved cell
   * renderers, the display resolution, the decorations — so a value reads
   * identically whichever presentation draws it.
   */
  private readonly cardViewModels = new CardViewModels<TRow>({
    api: () => this.gridApi,
    plan: () => this.cardPlan(),
    isSelected: (key) => this.selectionStore.isSelected(key),
    isExpanded: (key) => this.expansionStore.isExpanded(key),
    hasDetail: () => this.detailRenderer() != null,
    cellRenderers: () => this.cellRenderers(),
    groupRenderers: () => this.groupRenderers(),
    detailRenderer: () => this.resolvedDetail(),
    cardRenderer: () => this.cardRenderer(),
    decorateRow: () => this.resolvedDecorateRow(),
    decorateCell: () => this.resolvedDecorateCell(),
    booleanLabels: () => this.resolvedBooleanLabels(),
    timezone: () => this.resolvedTimezone(),
    locale: () => this.resolvedLanguage(),
    displayFor: (row, column, value) => this.displayFor(row, column, value),
    columnsByField: () => this.columnsByField(),
    toggleGroup: (path) => {
      this.toggleGroup(path);
    },
    collapseRow: (key) => {
      this.setRowExpanded(key, false);
    },
  });

  /**
   * Which presentation is drawn, and the media subscription behind `'auto'`.
   * Constructed here, in the injection context a field initializer runs in.
   */
  private readonly viewMode = new ViewMode({
    declared: this.view,
    breakpoint: this.cardsBelow,
    onChanged: (view) => {
      // A breakpoint can answer again while the page still loads, before the lazy dictionary:
      // `translate` would log the key as missing and announce nothing. Say nothing until it lands.
      const key = this.copy(
        view === 'cards' ? 'datagrid.announce.viewCards' : 'datagrid.announce.viewTable',
      );
      if (key in this.transloco.getTranslation(this.transloco.getActiveLang())) {
        this.announcement.set(this.transloco.translate(key));
      }
    },
  });

  /**
   * Starts the next page while the end of the loaded rows is still a screen
   * away. It serves both presentations: the sentinel sits at the end of the
   * scroll viewport, which the table and the card list share.
   */
  private readonly autoLoad = new AutoLoad({
    canLoadMore: () => this.canAutoLoad(),
    loadMore: () => {
      this.loadMore();
    },
  });

  protected readonly loading = computed(() => this.dataStore.loading());
  protected readonly initialLoading = computed(() => this.dataStore.initialLoading());
  private readonly refreshing = computed(
    () => this.dataStore.loading() && this.dataStore.settled(),
  );
  /** The initial load once it has run long enough to be worth a placeholder. */
  protected readonly initialLoadingVisible = computed(() => this.dataStore.initialLoadingVisible());
  protected readonly error = computed(() => this.dataStore.error());
  protected readonly liveMessage = computed(() => this.announcement());

  // --- Toolbar ------------------------------------------------------------

  /**
   * The toolbar's entries, in draw order.
   *
   * Three declarations feed one list — the config's items, the `templates` map
   * and the `libDatagridToolbar` directives — so ordering, visibility and
   * overflow are decided in one place. A built-in name is turned into a label,
   * an icon and a command here rather than in the bar: the bar draws entries
   * and knows nothing of the grid's own actions.
   */
  private readonly resolvedToolbar = computed(() =>
    this.fromConfig('toolbar', this.toolbar(), (config) => config.toolbar),
  );

  /**
   * Rows selected. An `allMatching` selection is a predicate over a dataset
   * the grid has not loaded, so it counts as "some" rather than as a number.
   */
  private readonly selectedCount = computed(() => {
    const snapshot = this.selectionStore.selection();
    return snapshot.kind === 'keys' ? snapshot.keys.length : Number.POSITIVE_INFINITY;
  });

  protected readonly toolbarEntries = computed<readonly ToolbarEntry[]>(() => {
    const toolbar = this.resolvedToolbar();
    const declared = toolbar?.items ?? [];
    const rendererSlots = this.slots().toolbarItem ?? {};
    // The bar-wide rule, which a single item overrides with its own — except
    // in the card view, where the bar is as narrow as the screen that asked
    // for cards and there is no room for a caption on any of them. The
    // overflow surface gives every caption back, so nothing is lost.
    const iconOnly = this.cardView() ? true : toolbar?.iconOnly;
    const entries: ToolbarEntry[] = [];
    // The feature descriptor is the opt-in, so the strip is placed without
    // being named as well. A host that names `views` places it itself and
    // this adds nothing — the same rule every other built-in follows, reached
    // from the other side.
    if (this.viewsFeature() != null && !namesToolbarItem(declared, 'views')) {
      const strip = builtInToolbarEntry('views', this.toolbarDeps, { order: -1 });
      if (strip != null) {
        entries.push(strip);
      }
    }
    const cardView = this.cardView();
    for (const item of declared) {
      if (cardView && typeof item !== 'string' && item.hideInCards === true) continue;
      let entry: ToolbarEntry | null;
      if (typeof item === 'string') {
        entry = builtInToolbarEntry(item, this.toolbarDeps, { iconOnly });
      } else if ('name' in item) {
        entry = builtInToolbarEntry(item.name, this.toolbarDeps, {
          location: item.location,
          order: item.order,
          overflow: item.overflow,
          iconOnly: item.iconOnly ?? iconOnly,
        });
      } else {
        entry = hostToolbarEntry(item, rendererSlots[item.id], {
          iconOnly,
          loading: this.loading(),
          refreshing: this.refreshing(),
        });
      }
      if (entry != null) {
        // A host item states its own `iconOnly`, which normally wins. The card
        // view's rule outranks it: it is about the space the bar has, not
        // about what the item would prefer.
        entries.push(this.cardView() ? withIconOnly(entry) : entry);
      }
    }
    for (const directive of this.toolbarTemplateQuery()) {
      entries.push({
        ...TOOLBAR_ENTRY_BASE,
        id: `template:${entries.length.toString()}`,
        location: directive.location(),
        kind: 'template',
        template: directive.template,
      });
    }
    return sortToolbarEntries(entries);
  });

  protected readonly hasToolbar = computed(
    () => this.resolvedToolbar()?.visible !== false && this.toolbarEntries().length > 0,
  );

  /** Whether the filter row is showing, which the `filterToggle` item flips. */
  private readonly filterRowShown = signal(true);

  /** Whether the group panel is showing, which the `groupPanel` item flips. */
  private readonly groupPanelShown = signal(true);

  /** Ids of built-in items the host has placed, so a bar and a strip never pair up. */
  private readonly toolbarItemIds = computed(
    () => new Set(this.toolbarEntries().map((entry) => entry.id)),
  );

  /** Everything the built-in toolbar items reach into the grid for. */
  private readonly toolbarDeps: ToolbarEntryDeps = {
    allows: (capability) => this.allows(capability),
    loading: this.loading,
    refreshing: this.refreshing,
    selectionMode: computed(() => this.resolvedSelectionMode()),
    selectedCount: this.selectedCount,
    hasSelection: computed(() => {
      const snapshot = this.selectionStore.selection();
      return snapshot.kind === 'allMatching' || this.selectionStore.selectedKeys().length > 0;
    }),
    // Withheld in the card view, where there is no filter row to toggle. The
    // filter panel and the builder are how filtering is reached there.
    hasFilterRow: computed(() => this.filterRowFeature() != null && !this.cardView()),
    filterRowShown: this.filterRowShown,
    groupPanelShown: this.groupPanelShown,
    canExport: computed(() => this.canExport()),
    exportFormats: computed(() => this.exportFormats()),
    exportBusy: computed(() => this.exportState() != null),
    autoRefresh: this.autoRefresh,
    autoRefreshInterval: this.autoRefreshInterval,
    refreshIntervals: computed(() => this.resolvedRefreshIntervals()),
    refreshSuspended: computed(() => this.refreshSuspended()),
    reload: () => {
      this.reload();
    },
    toggleAutoRefresh: () => {
      this.toggleAutoRefresh();
    },
    resetArrangement: () => {
      this.resetArrangement();
    },
    viewsRenderer: computed(() =>
      this.viewsFeature() == null ? null : this.viewsController.renderer(),
    ),
    clearSelection: () => {
      this.clearSelection();
    },
    exportGrid: (format, options) => {
      void this.exportGrid(format, options);
    },
    sortColumns: computed(() => this.sortMenuColumns()),
    hasSort: computed(() => this.sort().length > 0),
    cycleSort: (columnId) => {
      this.cycleSortColumn(columnId);
    },
    clearSort: () => {
      this.sort.set([]);
    },
    hasFilterBuilder: computed(() => this.showFilterBuilder()),
    openFilterBuilder: (event) => {
      this.onFilterBuilderRequested(event);
    },
    view: computed(() => this.resolvedView()),
    setView: (view) => {
      this.viewMode.set(view);
    },
  };

  // --- Configuration resolution -----------------------------------------
  //
  // Three layers, narrowest first: an explicit binding, the `[config]` object,
  // then `provideDatagridDefaults()`. "Explicit" is what Angular has ever
  // written to the input, which `ngOnChanges` reports for signal inputs as
  // well — comparing a value against its default cannot tell a host binding
  // `density="standard"` from a host binding nothing.

  /** Input names the template has bound, so a binding outranks the config. */
  private readonly boundInputs = signal<ReadonlySet<string>>(new Set());

  private readonly configLayers = computed<readonly ConfigLayer<TRow>[]>(() => [
    this.config(),
    this.injectedDefaults,
  ]);

  /** The bound value if the host bound it, else the config's, else the default. */
  private fromConfig<TValue>(
    name: string,
    bound: TValue,
    read: (config: Partial<GridConfig<TRow>>) => TValue | undefined,
  ): TValue {
    if (this.boundInputs().has(name)) {
      return bound;
    }
    return readConfigLayers(this.configLayers(), read) ?? bound;
  }

  /** The column declarations as written, bands and all. */
  protected readonly declaredColumns = computed(() =>
    this.fromConfig('columns', this.columns(), (config) => config.columns),
  );

  /** Where each column sits under the declared bands (§5.1). */
  private readonly bandIndex = computed(() => indexColumnBands(this.declaredColumns()));

  /**
   * The data columns: bands flattened away, the primary column's own rules
   * written on. Everything but the header reads this — a band draws a caption
   * and holds no data, so nothing below the header needs to know it exists.
   */
  protected readonly resolvedColumns = computed(() =>
    applyPrimaryRules(this.bandIndex().leaves, this.reportedPrimary),
  );

  protected readonly resolvedData = computed(() =>
    this.fromConfig('data', this.data(), (config) => config.data),
  );

  protected readonly resolvedKey = computed(() =>
    this.fromConfig('key', this.key(), (config) => config.key),
  );

  private readonly declaredSelectionMode = computed(() =>
    this.fromConfig('selectionMode', this.selectionMode(), (config) => config.selection?.mode),
  );

  /**
   * The selection mode in force. A grid that withholds the selection
   * capability selects nothing at all, so the checkbox column is not drawn and
   * no click, key or API call can select a row.
   */
  protected readonly resolvedSelectionMode = computed<SelectionMode>(() =>
    this.caps().selection ? this.declaredSelectionMode() : 'none',
  );

  protected readonly resolvedSelectAllMode = computed(() =>
    this.fromConfig(
      'selectAllMode',
      this.selectAllMode(),
      (config) => config.selection?.selectAllMode,
    ),
  );

  protected readonly resolvedToggleOnReactivate = computed(() =>
    this.fromConfig(
      'toggleOnReactivate',
      this.toggleOnReactivate(),
      (config) => config.selection?.toggleOnReactivate,
    ),
  );

  protected readonly resolvedMissingKeys = computed(() =>
    this.fromConfig('missingKeys', this.missingKeys(), (config) => config.selection?.missingKeys),
  );

  private readonly declaredPagingMode = computed(() =>
    this.fromConfig('pagingMode', this.pagingMode(), (config) => config.paging?.mode),
  );

  /**
   * Paging withheld loads what the source gives and offers no way to move.
   *
   * **The card view pages by scrolling.** A pager under a list of cards spends
   * a row of the content on a page-size selector and a set of page links, and
   * the screen that draws cards is the one with no row to spare — the pager
   * also ends up below the fold of a list the reader is already scrolling, so
   * the way to the next page is the gesture they are already making. `pager`
   * therefore resolves to `infinite` here, the same override the toolbar makes
   * for icon-only and for the same reason: it is about the space the
   * presentation has, which the host cannot know.
   *
   * `none` is left alone. A host that asked for the whole list gets it, and
   * the unpaged-cards warning already names the fix.
   */
  protected readonly resolvedPagingMode = computed<PagingMode>(() => {
    if (!this.caps().paging) {
      return 'none';
    }
    const declared = this.declaredPagingMode();
    return declared === 'pager' && this.cardView() ? 'infinite' : declared;
  });

  protected readonly resolvedRequireTotalCount = computed(() =>
    this.fromConfig(
      'requireTotalCount',
      this.requireTotalCount(),
      (config) => config.paging?.requireTotalCount,
    ),
  );

  protected readonly resolvedGroupPanel = computed(
    () =>
      this.caps().grouping &&
      this.fromConfig('groupPanel', this.groupPanel(), (config) => config.grouping?.panel),
  );

  protected readonly resolvedGroupDefaultExpanded = computed(() =>
    this.fromConfig(
      'groupDefaultExpanded',
      this.groupDefaultExpanded(),
      (config) => config.grouping?.defaultExpanded,
    ),
  );

  private readonly resolvedDetailRef = computed(() =>
    this.fromConfig('detail', this.detail(), (config) => config.detail?.renderer),
  );

  protected readonly resolvedDetailMode = computed(() =>
    this.fromConfig('detailMode', this.detailMode(), (config) => config.detail?.mode),
  );

  protected readonly resolvedSummaries = computed(() =>
    this.fromConfig('summaries', this.summaries(), (config) => config.summaries),
  );

  protected readonly resolvedBaseFilter = computed(() =>
    this.fromConfig('baseFilter', this.baseFilter(), (config) => config.filtering?.baseFilter),
  );

  protected readonly resolvedFilterSync = computed(() =>
    this.fromConfig('filterSync', this.filterSync(), (config) => config.filtering?.sync),
  );

  protected readonly resolvedDensity = computed(() =>
    this.fromConfig('density', this.density(), (config) => config.appearance?.density),
  );

  protected readonly resolvedStriped = computed(() =>
    this.fromConfig('striped', this.striped(), (config) => config.appearance?.striping),
  );

  protected readonly resolvedHoverHighlight = computed(() =>
    this.fromConfig(
      'hoverHighlight',
      this.hoverHighlight(),
      (config) => config.appearance?.hoverHighlight,
    ),
  );

  protected readonly resolvedRowSeparators = computed(() =>
    this.fromConfig(
      'rowSeparators',
      this.rowSeparators(),
      (config) => config.appearance?.rowSeparators,
    ),
  );

  protected readonly resolvedColumnSeparators = computed(() =>
    this.fromConfig(
      'columnSeparators',
      this.columnSeparators(),
      (config) => config.appearance?.columnSeparators,
    ),
  );

  protected readonly resolvedOuterBorder = computed(() =>
    this.fromConfig('outerBorder', this.outerBorder(), (config) => config.appearance?.outerBorder),
  );

  protected readonly resolvedWrapText = computed(() =>
    this.fromConfig('wrapText', this.wrapText(), (config) => config.appearance?.wrapText),
  );

  protected readonly resolvedDecorateRow = computed(() =>
    this.fromConfig('decorateRow', this.decorateRow(), (config) => config.decorateRow),
  );

  protected readonly resolvedDecorateCell = computed(() =>
    this.fromConfig('decorateCell', this.decorateCell(), (config) => config.decorateCell),
  );

  // --- Capabilities ------------------------------------------------------

  /** Whether the grid was declared read-only, whichever binding said so. */
  protected readonly readOnlyMode = computed(
    () =>
      this.readOnly() ||
      this.fromConfig('capabilities', this.capabilities(), (config) => config.capabilities)
        ?.readOnly === true,
  );

  /**
   * What the user may do here. Every affordance and every mutation reads it,
   * so hiding a control and refusing the action it performs cannot come apart.
   */
  protected readonly caps = computed<GridCapabilityMask>(() => {
    const declared = this.fromConfig(
      'capabilities',
      this.capabilities(),
      (config) => config.capabilities,
    );
    // The `readOnly` binding sets the base; the mask's own keys re-grant on
    // top of it, which is the order §3.3 asks for.
    return resolveCapabilities(
      this.readOnly() ? { ...(declared ?? {}), readOnly: true } : declared,
    );
  });

  /** Whether the grid permits an action at all, before any column has a say. */
  protected allows(capability: keyof GridCapabilityMask): boolean {
    return this.caps()[capability];
  }

  // --- Optional surfaces -------------------------------------------------

  private readonly filterRowFeature = computed(() => findFeature(this.features(), 'filterRow'));
  private readonly headerFilterFeature = computed(() =>
    findFeature(this.features(), 'headerFilter'),
  );

  protected readonly showFilterRow = computed(
    () =>
      this.ready() &&
      this.allows('filtering') &&
      this.filterRowFeature() != null &&
      this.filterRowShown(),
  );

  /**
   * The deferred-apply button, shown only while an edit is waiting.
   *
   * Deferred apply otherwise offers nothing at all: the user types, nothing
   * happens, and only `Enter` or moving focus away sends it. A button that is
   * always there would suggest the automatic path needs one too.
   */
  protected readonly showApplyFilters = computed(
    () =>
      this.showFilterRow() &&
      this.filterRowFeature()?.apply === 'deferred' &&
      this.pendingFilters().size > 0,
  );

  protected readonly showFilterPanel = computed(
    () => findFeature(this.features(), 'filterPanel') != null && this.filterChips().length > 0,
  );

  private readonly filterBuilderFeature = computed(() =>
    findFeature(this.features(), 'filterBuilder'),
  );

  protected readonly showFilterBuilder = computed(
    () => this.ready() && this.allows('filtering') && this.filterBuilderFeature() != null,
  );

  /**
   * The trigger's own bar, drawn only while the filter panel is not.
   *
   * The panel already carries the trigger among its actions (§7.2's edit
   * affordance), and it disappears whenever nothing filters the grid — which
   * is exactly when a user still needs a way in to build the first expression.
   */
  /**
   * The bar that carries the editor's trigger when nothing else does.
   *
   * The filter panel carries it as one of its actions, and the `filterBuilder`
   * toolbar item carries it as a button. A whole row spent on a trigger that
   * already has a home is chrome, so the bar is the last resort of the three.
   */
  protected readonly showFilterBuilderBar = computed(
    () =>
      this.showFilterBuilder() &&
      !this.showFilterPanel() &&
      !this.toolbarItemIds().has('filterBuilder'),
  );

  protected readonly filterBuilderPosition = computed<DatagridBarPosition>(
    () => this.filterBuilderFeature()?.position ?? 'top',
  );

  protected readonly showFilterBuilderBarTop = computed(
    () => this.showFilterBuilderBar() && this.filterBuilderPosition() === 'top',
  );

  protected readonly showFilterBuilderBarBottom = computed(
    () => this.showFilterBuilderBar() && this.filterBuilderPosition() === 'bottom',
  );

  /** Which edge the filter panel sits against. */
  protected readonly filterPanelPosition = computed<DatagridBarPosition>(
    () => findFeature(this.features(), 'filterPanel')?.position ?? 'top',
  );

  protected readonly showFilterPanelTop = computed(
    () => this.showFilterPanel() && this.filterPanelPosition() === 'top',
  );

  protected readonly showFilterPanelBottom = computed(
    () => this.showFilterPanel() && this.filterPanelPosition() === 'bottom',
  );

  /** The panel is an input as well as a feature; either one turns it on. */
  protected readonly showGroupPanel = computed(
    () =>
      this.allows('grouping') &&
      this.groupPanelShown() &&
      (this.resolvedGroupPanel() || findFeature(this.features(), 'groupPanel') != null),
  );

  /**
   * Rows above the body: the header, one row per band above it, plus the
   * filter row when it is on. Body rows index after them, and `aria-rowcount`
   * counts them.
   */
  protected readonly headerRows = computed(() => this.bandRows() + (this.showFilterRow() ? 1 : 0));

  /**
   * Rows the header itself occupies. The filter row sticks below all of them,
   * so the count travels to the styles as well as to the ARIA indices.
   */
  protected readonly bandRows = computed(() => this.bandIndex().depth + 1);

  /** Row height after normalization; never zero, which would divide the window by zero. */
  protected readonly resolvedRowHeight = computed(() => {
    const declared = this.rowHeight();
    if (Number.isFinite(declared) && declared > 0) {
      return Math.round(declared);
    }
    return DATAGRID_ROW_HEIGHT[this.resolvedDensity()];
  });

  protected readonly rowHeightPx = computed(() => `${this.resolvedRowHeight().toString()}px`);

  /** Height of a group header or footer row. Follows the data row height by default. */
  private readonly resolvedGroupRowHeight = computed(() => {
    const declared = this.groupRowHeight();
    return Number.isFinite(declared) && declared > 0
      ? Math.round(declared)
      : this.resolvedRowHeight();
  });

  private readonly resolvedDetailHeight = computed(() => {
    const declared = this.fromConfig(
      'detailHeight',
      this.detailHeight(),
      (config) => config.detail?.height,
    );
    return Number.isFinite(declared) && declared > 0 ? Math.round(declared) : 1;
  });

  /**
   * Whether the grid can render rows yet.
   *
   * §3.2 asks for a neutral shell until the configuration arrives, and a row
   * with no identity cannot be selected, focused or kept across a reload — so
   * both `columns` and `key` are needed before anything is drawn. Data still
   * loads meanwhile, which is what makes the transition a fill rather than a
   * remount.
   */
  protected readonly ready = computed(
    () => this.resolvedColumns().length > 0 && this.resolvedKey() != null,
  );

  /** The rows the grid may render: none until it is {@link ready}. */
  private readonly dataRows = computed(() => (this.ready() ? this.dataStore.rows() : NO_DATA));

  /** Host columns, with the grid's own columns prepended. */
  private readonly effectiveColumns = computed<readonly ColumnDef<TRow>[]>(() => {
    if (!this.ready()) {
      return [];
    }
    const host = this.columnStore.visibleColumns();
    const built: ColumnDef<TRow>[] = [];
    if (this.detailRenderer() != null) {
      built.push(detailColumn<TRow>(40));
    }
    if (this.resolvedSelectionMode() !== 'none') {
      built.push(selectionColumn<TRow>(44));
    }
    if (this.showRowNumbers()) {
      built.push(rowNumberColumn<TRow>(56));
    }
    return built.length === 0 ? host : [...built, ...host];
  });

  protected readonly layout = computed(() =>
    computeColumnLayout(this.effectiveColumns(), {
      containerWidth: this.viewportWidth(),
      defaultWidth: Math.max(1, this.defaultColumnWidth()),
      minWidth: Math.max(1, this.minColumnWidth()),
      fit: this.fitColumns(),
    }),
  );

  protected readonly totalWidthPx = computed(() => `${this.layout().totalWidth.toString()}px`);

  private readonly keyGetter = computed(() => {
    const spec = this.resolvedKey();
    return spec == null ? null : createKeyGetter(spec);
  });

  private readonly rowKeys = computed(() => {
    const getKey = this.keyGetter();
    return getKey == null ? [] : this.dataRows().map((row) => getKey(row));
  });

  private readonly keyIndex = computed(() => {
    const index = new Map<GridKey, number>();
    this.rowKeys().forEach((key, position) => index.set(key, position));
    return index;
  });

  /**
   * Absolute index of the first loaded row. Infinite scrolling accumulates
   * from the start, so its rows are already absolute and the query's `skip`
   * must not be added a second time.
   */
  private readonly rowIndexOffset = computed(() =>
    this.resolvedPagingMode() === 'infinite' ? 0 : (this.queryStore.query().skip ?? 0),
  );

  /**
   * True when the rendered window covers the entire body, so a reorder has a
   * destination on screen for every row rather than for the few that happen
   * to survive it.
   */
  protected readonly animateReorder = computed(() => {
    if (!this.animateRows()) {
      return false;
    }
    const count = this.offsets().count;
    if (count === 0) {
      return false;
    }
    const window = this.rowWindow();
    return window.start === 0 && window.end >= count;
  });

  // --- Grouping, summaries and detail -----------------------------------

  private readonly totalSummaries = computed(() =>
    summariesOfScope(this.resolvedSummaries(), 'total'),
  );
  private readonly groupSummaries = computed(() =>
    summariesOfScope(this.resolvedSummaries(), 'group'),
  );

  /**
   * The group summaries drawn under their own column, in either the group
   * header or the group footer.
   */
  private readonly alignedGroupSummaries = computed(() =>
    this.groupSummaries().filter((summary) => (summary.placement ?? 'header') !== 'header'),
  );

  private readonly hasGroupFooters = computed(() =>
    this.groupSummaries().some((summary) => summary.placement === 'footer'),
  );

  protected readonly hasGridFooter = computed(
    () => this.ready() && this.totalSummaries().length > 0,
  );

  /** The detail renderer: the directive, then the slot map, then the binding. */
  private readonly detailRenderer = computed<RendererRef | null>(
    () => this.detailTemplate()?.template ?? this.slots().detail ?? this.resolvedDetailRef(),
  );

  /** Columns by the field they read, so a group level finds its column. */
  private readonly columnsByField = computed(() => {
    const map = new Map<string, ColumnDef<TRow>>();
    for (const column of this.columnStore.columns()) {
      map.set(columnField(column), column);
    }
    return map;
  });

  /**
   * Reads a query field off a row through the column that declares it, so a
   * computed column is grouped, filtered, searched and totalled by what it
   * reads rather than by a path that does not exist. A field no column
   * declares falls back to plain dot-path access.
   */
  private readonly fieldValueGetter = computed(() => {
    const byField = this.columnsByField();
    return (row: TRow, field: string): unknown => {
      const column = byField.get(field);
      return column === undefined ? getPath(row, field) : resolveCellValue(row, column);
    };
  });

  /**
   * The fields a local global search scans.
   *
   * Without them the engine falls back to the own keys of the first row: it
   * would search properties no column shows, miss every nested and computed
   * one, and take its domain from whatever shape one row happens to have. The
   * visible columns are the answer to "what is this grid showing".
   */
  private readonly searchFields = computed(() =>
    this.columnStore.visibleColumns().map((column) => columnField(column)),
  );

  /**
   * The group tree, or `null` when the grid is not grouped.
   *
   * A source that grouped remotely owns the values, the counts and the
   * aggregates; otherwise the grid groups the rows it has, which under paging
   * is the current page.
   */
  private readonly groupNodes = computed<readonly GroupNode<TRow>[] | null>(() => {
    const specs = this.group();
    if (!this.ready() || specs.length === 0) {
      return null;
    }
    const remote = this.dataStore.groups();
    if (remote != null) {
      return groupNodesFromResult(remote, specs);
    }
    return buildGroups(this.dataRows(), specs, {
      getValue: this.fieldValueGetter(),
      aggregates: summaryAggregateSpecs(this.groupSummaries()),
      customAggregates: this.localCustomAggregates(),
    });
  });

  private readonly localCustomAggregates = computed(() => ({
    ...customAggregatesOf(this.resolvedSummaries()),
    ...(this.customAggregates() ?? {}),
  }));

  /**
   * The flattened body, or `null` when it is nothing but data rows.
   *
   * The plain case deliberately materializes no list: a grid of ten thousand
   * rows would otherwise build ten thousand entries on every data change, when
   * index maps to row directly.
   */
  private readonly bodyItems = computed<readonly GridBodyItem<TRow>[] | null>(() => {
    const groups = this.groupNodes();
    const expansions = this.expansionStore.keys();
    const expandable = this.detailRenderer() != null;
    if (groups == null && !(expandable && expansions.size > 0)) {
      return null;
    }
    const keyGetter = this.keyGetter();
    if (keyGetter == null) {
      return null;
    }
    // Read untracked-free: both signals are dependencies of the expansion test.
    const defaultExpanded = this.groupStore.defaultExpanded();
    const exceptions = this.groupStore.exceptions();
    return buildBodyItems(this.dataRows(), groups, {
      keyOf: keyGetter,
      isGroupExpanded: (path) =>
        exceptions.has(groupPathKey(path)) ? !defaultExpanded : defaultExpanded,
      isRowExpanded: (key) => expandable && expansions.has(key),
      groupFooters: this.hasGroupFooters(),
      heights: {
        data: this.resolvedRowHeight(),
        group: this.resolvedGroupRowHeight(),
        groupFooter: this.resolvedGroupRowHeight(),
        detail: this.resolvedDetailHeight(),
      },
      startIndex: this.rowIndexOffset(),
    });
  });

  /** Where every entry sits. Uniform arithmetic while the body is plain rows. */
  private readonly offsets = computed<RowOffsets>(() => {
    const items = this.bodyItems();
    const rowHeight = this.resolvedRowHeight();
    return items == null
      ? createRowOffsets(null, { count: this.dataRows().length, rowHeight })
      : createRowOffsets(
          items.map((item) => item.height),
          { count: items.length, rowHeight },
        );
  });

  protected readonly totalHeight = computed(() => this.offsets().totalHeight);

  private readonly rowWindow = computed(() =>
    computeWindow(this.offsets(), {
      scrollTop: this.scrollTop(),
      viewportHeight: this.viewportHeight(),
      overscan: this.overscan(),
    }),
  );

  /**
   * Keys of the entries the focus model walks: data rows and group headers.
   * A footer and a detail region carry no cell of their own.
   */
  private readonly focusKeys = computed<readonly GridKey[]>(() => {
    const items = this.bodyItems();
    if (items == null) {
      return this.rowKeys();
    }
    const keys: GridKey[] = [];
    for (const item of items) {
      if (item.kind === 'data') {
        keys.push(item.key);
      } else if (item.kind === 'group') {
        keys.push(groupFocusKey(item.node.path));
      }
    }
    return keys;
  });

  /** Entry index of every focusable key, for scrolling one into view. */
  private readonly itemIndexByKey = computed(() => {
    const index = new Map<GridKey, number>();
    const items = this.bodyItems();
    if (items == null) {
      this.rowKeys().forEach((key, position) => index.set(key, position));
      return index;
    }
    items.forEach((item, position) => {
      if (item.kind === 'data') {
        index.set(item.key, position);
      } else if (item.kind === 'group') {
        index.set(groupFocusKey(item.node.path), position);
      }
    });
    return index;
  });

  private readonly cellTemplates = computed(() => {
    const map = new Map<string, TemplateRef<CellTemplateContext<TRow>>>();
    for (const directive of this.cellTemplateQuery()) {
      map.set(directive.libDatagridCell(), directive.template);
    }
    return map;
  });

  private readonly headerTemplates = computed(() => {
    const map = new Map<string, TemplateRef<HeaderTemplateContext<TRow>>>();
    for (const directive of this.headerTemplateQuery()) {
      map.set(directive.libDatagridHeader(), directive.template);
    }
    return map;
  });

  /** The slot map, which every renderer resolution consults in second place. */
  private readonly slots = computed<GridTemplates>(
    () => this.fromConfig('templates', this.templates(), (config) => config.templates) ?? {},
  );

  /**
   * Resolves one renderer slot, in the order §6.1 asks the grid to document.
   *
   * A directive is written on this grid and wins; the `templates` map is a
   * value bound on this grid and comes next; the reference on a `ColumnDef` or
   * a config object may come from shared configuration that knows nothing
   * about this screen, so it loses to both.
   */
  private resolveSlot<TContext>(
    directive: TemplateRef<TContext> | null | undefined,
    fromMap: RendererRef | null | undefined,
    fromDefinition: RendererRef | null | undefined,
  ): ResolvedRenderer<TContext> {
    if (directive != null) {
      return { template: directive, component: null };
    }
    return resolveRenderer<TContext>(fromMap ?? fromDefinition);
  }

  /**
   * The cell renderer of each column, resolved once per column rather than
   * once per cell.
   *
   * Resolution order is the documented one: a `libDatagridCell` directive
   * wins over `ColumnDef.cell`, because a directive is written on this grid
   * while the reference may come from shared configuration. Both branches of
   * `RendererRef` are honoured — a component type is the only form that
   * survives being passed as a value through a wrapper.
   */
  private readonly cellRenderers = computed(() => {
    const directives = this.cellTemplates();
    const slots = this.slots().cell;
    const map = new Map<string, ResolvedRenderer<CellTemplateContext<TRow>>>();
    for (const column of this.effectiveColumns()) {
      map.set(
        column.id,
        this.resolveSlot<CellTemplateContext<TRow>>(
          directives.get(column.id),
          slots?.[column.id],
          // The primary column draws an activation control unless the host
          // draws its own, which is what makes the identifier reachable
          // without every caller writing a renderer for it (§5.1).
          column.cell ?? (primarySpecOf(column) == null ? undefined : DatagridPrimaryCell),
        ),
      );
    }
    return map;
  });

  /**
   * The header renderer of each column and of each band. Same resolution order
   * as the cell.
   */
  private readonly headerRenderers = computed(() => {
    const directives = this.headerTemplates();
    const slots = this.slots().header;
    const map = new Map<string, ResolvedRenderer<HeaderTemplateContext<TRow>>>();
    for (const column of [...this.bandIndex().bands.values(), ...this.effectiveColumns()]) {
      map.set(
        column.id,
        this.resolveSlot<HeaderTemplateContext<TRow>>(
          directives.get(column.id),
          slots?.[column.id],
          column.header,
        ),
      );
    }
    return map;
  });

  /**
   * Group renderers by column id, plus `''` for the fallback that draws every
   * group. Same resolution order as the cell: a directive wins over the
   * `ColumnDef` reference.
   */
  private readonly groupRenderers = computed(() => {
    const map = new Map<string, ResolvedRenderer<GroupRowTemplateContext<TRow>>>();
    for (const column of this.columnStore.columns()) {
      if (column.groupCell != null) {
        map.set(column.id, resolveRenderer<GroupRowTemplateContext<TRow>>(column.groupCell));
      }
    }
    for (const [id, ref] of Object.entries(this.slots().group ?? {})) {
      map.set(id, resolveRenderer<GroupRowTemplateContext<TRow>>(ref));
    }
    for (const directive of this.groupTemplateQuery()) {
      map.set(directive.libDatagridGroup(), { template: directive.template, component: null });
    }
    return map;
  });

  private readonly summaryRenderers = computed(() => {
    const map = new Map<string, ResolvedRenderer<SummaryCellTemplateContext<TRow>>>();
    for (const summary of this.resolvedSummaries()) {
      if (summary.renderer != null) {
        map.set(
          this.summaryColumnId(summary),
          resolveRenderer<SummaryCellTemplateContext<TRow>>(summary.renderer),
        );
      }
    }
    for (const [id, ref] of Object.entries(this.slots().summary ?? {})) {
      map.set(id, resolveRenderer<SummaryCellTemplateContext<TRow>>(ref));
    }
    for (const directive of this.summaryTemplateQuery()) {
      map.set(directive.libDatagridSummary(), { template: directive.template, component: null });
    }
    return map;
  });

  private readonly resolvedDetail = computed(() =>
    resolveRenderer<DetailTemplateContext<TRow>>(this.detailRenderer()),
  );

  protected readonly emptyRenderer = computed(() =>
    this.resolveSlot<unknown>(this.emptyTemplate()?.template, this.slots().empty, null),
  );

  protected readonly noResultsRenderer = computed(() =>
    this.resolveSlot<unknown>(this.noResultsTemplate()?.template, this.slots().noResults, null),
  );

  protected readonly errorRenderer = computed(() =>
    this.resolveSlot<DatagridErrorContext>(
      this.errorTemplate()?.template,
      this.slots().error,
      null,
    ),
  );

  protected readonly loadingRenderer = computed(() =>
    this.resolveSlot<unknown>(this.loadingTemplate()?.template, this.slots().loading, null),
  );

  /** Whether a state slot was filled at all, by either branch. */
  protected hasRenderer<TContext>(renderer: ResolvedRenderer<TContext>): boolean {
    return renderer.template != null || renderer.component != null;
  }

  /**
   * The display value of a cell, with the column's lookup resolving a stored
   * value into its display value (§5.3).
   *
   * A value the collection does not cover falls back to itself: an unmapped
   * code is still data, and blanking the cell would hide it.
   */
  private displayFor(row: TRow, column: ColumnDef<TRow>, value: unknown): unknown {
    const display = resolveDisplayValue(row, column, value);
    if (column.lookup == null) {
      return display;
    }
    return this.lookupStore.displayOf(column.id, value) ?? display;
  }

  /** Keys of the loaded rows, which is what a page-scoped select-all covers. */
  private readonly pageKeys = computed(() => this.rowKeys());

  protected readonly selectAllState = computed(() => {
    this.selectionVersion();
    return this.selectionStore.pageState(this.pageKeys());
  });

  /** Bumped on every selection write, so the row cache and header re-derive. */
  private readonly selectionVersion = computed(() => this.selectionStore.selection());

  /**
   * The banded header, derived from the columns as they are rendered — so a
   * span follows hiding, reordering and pinning without being told to (§5.1).
   */
  private readonly headerMatrix = computed(() =>
    computeHeaderMatrix(this.layout().columns, this.bandIndex()),
  );

  /** Band rows above the leaf header row. Empty when no band is declared. */
  protected readonly headerBands = computed<DatagridRenderBandRow<TRow>[]>(() => {
    const renderers = this.headerRenderers();
    const reorderable = this.caps().reordering && this.allowColumnReorder();
    const bands = this.bandIndex().bands;
    return this.headerMatrix().bandRows.map((cells, row) => ({
      ariaRowIndex: row + 1,
      cells: cells.map((cell) => {
        const band = bands.get(cell.id);
        const renderer = renderers.get(cell.id) ?? noRenderer<HeaderTemplateContext<TRow>>();
        const context =
          (renderer.template == null && renderer.component == null) || band === undefined
            ? null
            : withImplicit<HeaderContext<TRow>>({ column: band, api: this.gridApi });
        return {
          bandId: cell.id,
          caption: cell.caption,
          parentId: cell.parentId,
          row: cell.row,
          colIndex: cell.colIndex,
          colSpan: cell.colSpan,
          pinned: cell.pinned,
          edge: cell.edge,
          insetStart: cell.pinned === 'start' ? cell.inset : null,
          insetEnd: cell.pinned === 'end' ? cell.inset : null,
          reorderable: reorderable && band?.allow?.reordering !== false,
          template: renderer.template,
          component:
            renderer.component == null ? null : { type: renderer.component, inputs: { context } },
          context,
        };
      }),
    }));
  });

  protected readonly headerCells = computed<DatagridRenderHeaderCell<TRow>[]>(() => {
    const renderers = this.headerRenderers();
    const placements = this.headerMatrix().leaves;
    const sort = this.sort();
    const caps = this.caps();
    const sortable = this.sortable() && caps.sorting;
    const selectAll = this.selectAllState();
    const groupedFields = new Set(this.group().map((spec) => spec.field));
    const headerFilter = caps.filtering && this.headerFilterFeature() != null;
    const columnFilters = this.queryStore.columnFilters();
    const headerFilters = this.queryStore.headerFilters();
    const relatives = this.queryStore.relativeDateFilters();
    return this.layout().columns.map((entry, position) => {
      const renderer = renderers.get(entry.id) ?? noRenderer<HeaderTemplateContext<TRow>>();
      const context =
        renderer.template == null && renderer.component == null
          ? null
          : withImplicit<HeaderContext<TRow>>({ column: entry.column, api: this.gridApi });
      const kind = headerCellKind(entry.id);
      const field = sortFieldOf(entry.column);
      return {
        columnId: entry.id,
        kind,
        colIndex: position + 1,
        // A built-in column draws a control or a glyph, never a caption. Its
        // internal id is not a caption either, and it is what would show here.
        caption: kind === 'data' ? (entry.column.caption ?? entry.column.field ?? entry.id) : '',
        labelKey: BUILT_IN_HEADER_LABELS[kind],
        template: renderer.template,
        component:
          renderer.component == null ? null : { type: renderer.component, inputs: { context } },
        context,
        pinned: entry.pinned,
        edge: entry.edge,
        insetStart: entry.pinned === 'start' ? entry.inset : null,
        insetEnd: entry.pinned === 'end' ? entry.inset : null,
        sort: kind === 'data' ? sortDirectionOf(sort, field) : null,
        sortOrdinal: kind === 'data' ? sortOrdinalOf(sort, field) : null,
        sortable: kind === 'data' && sortable && entry.column.allow?.sorting !== false,
        resizable:
          caps.resizing && this.allowColumnResize() && entry.column.allow?.resizing !== false,
        reorderable:
          caps.reordering && this.allowColumnReorder() && entry.column.allow?.reordering !== false,
        hideable: kind === 'data' && caps.hiding && entry.column.allow?.hiding !== false,
        groupable: kind === 'data' && caps.grouping && entry.column.allow?.grouping !== false,
        grouped: groupedFields.has(columnField(entry.column)),
        filterable:
          kind === 'data' &&
          headerFilter &&
          entry.column.allow?.filtering !== false &&
          entry.column.allow?.headerFiltering !== false,
        // Either slot marks the column, so the funnel reports the header
        // filter and the row filter alike.
        filtered:
          columnFilters.has(entry.id) || headerFilters.has(entry.id) || relatives.has(entry.id),
        selectAll,
        ...(placements.get(entry.id) ?? UNBANDED_PLACEMENT),
      };
    });
  });

  // --- Filtering surfaces -----------------------------------------------

  /** Renders a value the way its column would display it, for the summaries. */
  private readonly formatFilterValue = computed(() => {
    const booleanLabels = this.resolvedBooleanLabels();
    const timezone = this.resolvedTimezone();
    const locale = this.resolvedLanguage();
    return (value: unknown, column: ColumnDef<TRow> | undefined): string =>
      formatCellText(value, column ?? { id: '' }, { booleanLabels, timezone, locale });
  });

  /**
   * The filter row's cells.
   *
   * A cell prefers the editor state that produced the stored node, so a
   * widened date range still reads back as the day the user picked. Anything
   * else is read out of the node, and anything the row cannot read is
   * reported rather than shown as empty (§7.3).
   */
  /**
   * Conditions of the free filter tree the filter row can show, by field.
   *
   * §7.3 mirrors the tree into the per-column surfaces, which only holds for
   * an expression one cell can carry: one plain condition on the field, at the
   * top level of the `and`. A second condition on the same field maps to
   * `null` — the field is in the tree, and the row cannot show what it says.
   * Groups and negations name no single field and stay in the filter panel.
   */
  private readonly mirroredTreeFilters = computed<ReadonlyMap<string, FilterNode | null>>(() => {
    if (!this.resolvedFilterSync()) {
      return new Map();
    }
    const byField = new Map<string, FilterNode | null>();
    for (const node of flattenAnd(this.queryStore.filter())) {
      if (isConditionNode(node)) {
        byField.set(node.field, byField.has(node.field) ? null : node);
      }
    }
    return byField;
  });

  protected readonly filterCells = computed<DatagridFilterCell[]>(() => {
    if (!this.showFilterRow()) {
      return [];
    }
    const editors = this.filterEditors();
    const stored = this.queryStore.columnFilters();
    const relatives = this.queryStore.relativeDateFilters();
    const mirrored = this.mirroredTreeFilters();
    // Only deferred apply leaves an edit visibly waiting. On the automatic
    // path the debounce clears it within a few hundred milliseconds, and a
    // marker that flickers on every keystroke is noise.
    const pending =
      this.filterRowFeature()?.apply === 'deferred' ? this.pendingFilters() : new Set<string>();
    return this.layout().columns.map((entry, position) => {
      const base = {
        columnId: entry.id,
        colIndex: position + 1,
        caption: entry.column.caption ?? entry.column.field ?? entry.id,
        pinned: entry.pinned,
        edge: entry.edge,
        insetStart: entry.pinned === 'start' ? entry.inset : null,
        insetEnd: entry.pinned === 'end' ? entry.inset : null,
      };
      // `rowFiltering` is the filter row's own switch, as `headerFiltering` is the funnel's.
      const filterable =
        !isBuiltInColumn(entry.id) &&
        entry.column.allow?.filtering !== false &&
        entry.column.allow?.rowFiltering !== false;
      if (!filterable) {
        return {
          ...base,
          editor: 'none' as const,
          operators: [],
          op: 'eq' as const,
          arity: 'none' as const,
          relativePresets: [],
          relative: null,
          value: null,
          valueEnd: null,
          unsupported: false,
          pending: false,
        };
      }
      const field = columnField(entry.column);
      const owned = stored.get(entry.id) ?? null;
      const mirroredNode = mirrored.get(field) ?? null;
      // Two surfaces claiming one field, or a tree expression no cell can
      // hold: either way the row reports rather than showing half of it.
      const conflict = mirrored.has(field) && (owned != null || mirroredNode == null);
      const resolved = this.resolveFilterEditor(
        entry.column,
        editors.get(entry.id) ?? null,
        owned ?? mirroredNode,
      );
      return {
        ...base,
        editor: filterEditorFor(entry.column),
        operators: filterOperatorsFor(entry.column),
        op: resolved.op,
        arity: filterOperatorArity(resolved.op),
        relativePresets: relativePresetsFor(entry.column),
        relative: relatives.get(entry.id)?.filter ?? null,
        value: resolved.value,
        valueEnd: resolved.valueEnd,
        unsupported: resolved.unsupported || conflict,
        pending: pending.has(entry.id),
      };
    });
  });

  /** What one cell shows: the editor's own state, or what the node says. */
  private resolveFilterEditor(
    column: ColumnDef<TRow>,
    state: FilterEditorState | null,
    node: FilterNode | null,
  ): FilterEditorState & { unsupported: boolean } {
    const fallback = { op: state?.op ?? defaultFilterOperator(column) };
    if (state != null && structurallyEqual(this.editorNode(column, state), node)) {
      return { ...state, unsupported: false };
    }
    if (node == null) {
      return { ...fallback, value: null, valueEnd: null, unsupported: false };
    }
    const read = readColumnFilter(node, columnField(column));
    if (read == null) {
      return { ...fallback, value: null, valueEnd: null, unsupported: true };
    }
    if (filterOperatorArity(read.op) === 'range') {
      const range = Array.isArray(read.value) ? read.value : [];
      return {
        op: read.op,
        value: range[0] ?? null,
        valueEnd: range[1] ?? null,
        unsupported: false,
      };
    }
    return { op: read.op, value: read.value ?? null, valueEnd: null, unsupported: false };
  }

  /** The node an editor state produces. A range hands both bounds over as one. */
  private editorNode(column: ColumnDef<TRow>, state: FilterEditorState): FilterNode | null {
    const value =
      filterOperatorArity(state.op) === 'range' ? [state.value, state.valueEnd] : state.value;
    return buildColumnFilter(column, state.op, value);
  }

  protected readonly filterChips = computed<DatagridFilterChip[]>(() =>
    describeFilters<TRow>({
      columns: this.columnStore.columns(),
      columnFilters: this.queryStore.columnFilters(),
      headerFilters: this.queryStore.headerFilters(),
      relativeFilters: this.queryStore.relativeDateFilters(),
      // With synchronization off the free tree is the host's scope, not the
      // user's filter, so the panel does not offer to clear it.
      tree: this.resolvedFilterSync() ? this.queryStore.filter() : null,
      search: this.search(),
      formatValue: this.formatFilterValue(),
    }).map((entry) => ({
      id: entry.id,
      caption: entry.caption,
      labelKey: entry.labelKey,
      labelParams: entry.labelParams,
      text: entry.text,
      representable: entry.representable,
    })),
  );

  // --- Filter builder ----------------------------------------------------

  /**
   * The open expression editor, and the trigger it hangs off.
   *
   * An overlay rather than a modal dialog, and the browser decides that: a
   * modal `<dialog>` draws in the top layer, above every overlay, so the date
   * pickers and the choosers opened from inside one would paint behind it.
   */
  private filterBuilderOverlay: PopoverComponentRef<unknown> | null = null;
  private filterBuilderAnchor: HTMLElement | null = null;
  /**
   * True from a dismissal by a press outside until the next task. A press on the trigger is
   * outside the pane, so the popover closes the editor in the click's capture phase, and the
   * trigger's own handler, later in the same dispatch, would open it again: the editor
   * flickered and stayed. Cleared on the next task, so only that one press is swallowed.
   */
  private filterBuilderJustDismissed = false;

  /**
   * Fields the expression editor offers, one per filterable column.
   *
   * Keyed by query field and not by column id, because a condition names a
   * field: two columns over one field would otherwise offer the same condition
   * twice and disagree about which one a read-back belongs to.
   */
  protected readonly filterFields = computed<readonly DatagridFilterField[]>(() => {
    const fields = new Map<string, DatagridFilterField>();
    for (const column of this.columnStore.columns()) {
      if (isBuiltInColumn(column.id) || column.allow?.filtering === false) {
        continue;
      }
      const field = columnField(column);
      if (field === '' || fields.has(field)) {
        continue;
      }
      fields.set(field, {
        field,
        caption: column.caption ?? column.field ?? column.id,
        editor: filterEditorFor(column),
        operators: filterOperatorsFor(column),
      });
    }
    return [...fields.values()];
  });

  /**
   * Builds a condition through the column that declares its field, so an
   * expression widens a date to its day and honours `filterExpression` exactly
   * as the filter row does. A field with no column left falls back to a plain
   * condition rather than vanishing.
   */
  protected readonly filterBuilderCondition = computed<BuilderConditionBuilder>(() => {
    const byField = new Map(
      this.columnStore.columns().map((column) => [columnField(column), column]),
    );
    return (item) => {
      const column = byField.get(item.field);
      if (column == null) {
        return defaultBuilderCondition(item);
      }
      const value =
        filterOperatorArity(item.op) === 'range'
          ? [item.value ?? null, item.valueEnd ?? null]
          : item.value;
      return buildColumnFilter(column, item.op, value);
    };
  });

  /**
   * Per-column filters the expression does not hold. Reported inside the
   * editor, because applying an expression leaves them in force and §7.3
   * forbids letting a surface look like the whole filter.
   */
  protected readonly otherFilterCount = computed(
    () => this.queryStore.columnFilters().size + this.queryStore.headerFilters().size,
  );

  /**
   * Opens the expression editor over the trigger that asked for it.
   *
   * Imported dynamically, and referenced statically nowhere, so a grid that
   * never opens the editor never downloads it — the split the filter row gets
   * from `@defer`, taken the only way an imperatively opened surface can.
   */
  async openFilterBuilder(anchor?: HTMLElement): Promise<void> {
    const trigger = anchor ?? this.filterBuilderAnchor;
    if (!this.showFilterBuilder() || trigger == null || this.filterBuilderOverlay != null) {
      return;
    }
    const { DatagridFilterBuilder } = await import('./filter-builder/datagrid-filter-builder');
    // Past the end of the press that asked for it, always. CDK's outside-click
    // dispatcher records the target on `pointerdown` and decides on `click`,
    // and a panel that attaches while that click is still propagating gets the
    // click reported as a press outside itself — so it opens and closes again
    // in one gesture. The import already yields on a cold chunk; a warm one
    // resolves in a microtask, which is still inside the dispatch.
    await new Promise((resolve) => setTimeout(resolve, 0));
    if (this.destroyed) {
      return;
    }
    const overlay = this.popover.openComponent(DatagridFilterBuilder, {
      anchor: trigger,
      positions: FILTER_BUILDER_POSITIONS,
      injector: this.injector,
      onClose: (reason) => {
        if (reason === 'outside') {
          this.filterBuilderJustDismissed = true;
          setTimeout(() => {
            this.filterBuilderJustDismissed = false;
          }, 0);
        }
        if (this.filterBuilderOverlay === overlay) {
          this.filterBuilderOverlay = null;
          this.filterBuilderOpen.set(false);
        }
      },
    });
    this.filterBuilderOverlay = overlay;
    this.filterBuilderOpen.set(true);
    const panel = overlay.componentRef;
    panel.setInput('fields', this.filterFields());
    panel.setInput('value', this.queryStore.filter());
    panel.setInput('buildCondition', this.filterBuilderCondition());
    panel.setInput('otherFilterCount', this.otherFilterCount());
    panel.setInput(
      'builderLabel',
      this.transloco.translate(this.copy('datagrid.filterBuilder.label')),
    );
    panel.setInput('translate', this.translate);
    panel.instance.applied.subscribe((node) => {
      this.applyBuiltFilter(node);
      void overlay.ref.close();
    });
    panel.instance.canceled.subscribe(() => {
      void overlay.ref.close();
    });
  }

  private applyBuiltFilter(node: FilterNode | null): void {
    this.filter.set(node);
    // The editor rewrote every field it names, so an editor state describing
    // the old condition would fight the tree on the next keystroke.
    this.filterEditors.set(new Map());
    this.pendingFilters.set(new Set());
  }

  /** Remembers the trigger, so the panel hangs off whichever one was pressed. */
  protected onFilterBuilderRequested(event: Event): void {
    if (this.filterBuilderOverlay != null) {
      // Pressed while open, with no dismissal on the way: the trigger closes what it opened.
      void this.filterBuilderOverlay.ref.close();
      return;
    }
    if (this.filterBuilderJustDismissed) {
      return;
    }
    const target = event.currentTarget;
    this.filterBuilderAnchor = target instanceof HTMLElement ? target : null;
    void this.openFilterBuilder(this.filterBuilderAnchor ?? undefined);
  }

  /**
   * Entries for the current window, plus the focused one when it scrolled out.
   * Keeping the focused row mounted is what stops the browser from dropping
   * focus to the document body mid-scroll.
   */
  protected readonly renderItems = computed<DatagridRenderItem<TRow>[]>(() => {
    this.renderTick();
    const layout = this.layout();
    const window = this.rowWindow();
    const offsets = this.offsets();
    const focused = this.focusStore.cell();
    const flattened = this.bodyItems() != null;
    this.selectionVersion();
    // Read unconditionally, not through the cells: a pass in which every row
    // is a cache hit never reaches the lookup, which would drop it from this
    // computed's dependencies and leave a collection that resolves afterwards
    // showing raw codes forever.
    this.lookupStore.version();

    const indices: number[] = [];
    for (let index = window.start; index < window.end; index += 1) {
      indices.push(index);
    }
    if (focused != null) {
      const focusedIndex = this.itemIndexByKey().get(focused.key);
      if (
        focusedIndex !== undefined &&
        (focusedIndex < window.start || focusedIndex >= window.end)
      ) {
        indices.push(focusedIndex);
        indices.sort((a, b) => a - b);
      }
    }

    const result: DatagridRenderItem<TRow>[] = [];
    const liveKeys: GridKey[] = [];
    const headerRows = this.headerRows();
    for (const index of indices) {
      const item = this.itemAt(index);
      if (item === undefined) {
        continue;
      }
      const placement = {
        top: offsets.offsetOf(index),
        ariaRowIndex: (flattened || item.kind !== 'data' ? index : item.dataIndex) + 1 + headerRows,
      };
      switch (item.kind) {
        case 'data':
          result.push(this.rowViewModels.row(item, placement, layout, focused));
          liveKeys.push(item.key);
          break;
        case 'group':
          result.push(this.rowViewModels.groupRow(item.node, item.expanded, placement, layout));
          break;
        case 'groupFooter':
          result.push(this.rowViewModels.groupFooter(item.node, item.level, placement, layout));
          break;
        case 'detail':
          result.push(this.rowViewModels.detail(item.key, item.row, item.height, placement));
          break;
      }
    }
    this.rowViewModels.prune(liveKeys);
    return result;
  });

  /**
   * The entry at an index. Synthesized on the plain path, where the body is
   * the data rows and no list the size of the dataset is ever materialized.
   */
  private itemAt(index: number): GridBodyItem<TRow> | undefined {
    const items = this.bodyItems();
    if (items != null) {
      return items[index];
    }
    const row = this.dataRows()[index];
    if (row === undefined) {
      return undefined;
    }
    return {
      kind: 'data',
      key: this.rowKeys()[index],
      row,
      dataIndex: this.rowIndexOffset() + index,
      level: 0,
      height: this.resolvedRowHeight(),
    };
  }

  // --- The card view (§5.4) ---------------------------------------------

  protected readonly resolvedCards = computed<CardViewConfig>(
    () => this.fromConfig('cards', this.cards(), (config) => config.cards) ?? EMPTY_CARDS,
  );

  /** Which presentation is drawn. `'auto'` has already resolved here. */
  protected readonly resolvedView = computed<ResolvedDatagridView>(() => this.viewMode.view());

  protected readonly cardView = computed(() => this.resolvedView() === 'cards');

  protected readonly cardMinWidth = computed(() => {
    const declared = this.resolvedCards().minWidth ?? DEFAULT_CARD_MIN_WIDTH;
    return declared > 0 ? Math.floor(declared) : DEFAULT_CARD_MIN_WIDTH;
  });

  /**
   * Where each column draws on a card. Derived from the columns as they are
   * rendered, so hiding one through the chooser drops its field from every
   * card without the card view being told.
   */
  /** Whether a rendered column opens the record, which makes a card press open it too. */
  private readonly hasPrimaryColumn = computed(() =>
    this.effectiveColumns().some((column) => primarySpecOf(column) != null),
  );

  private readonly cardPlan = computed<CardFieldPlan<TRow>>(() =>
    planCardFields(this.effectiveColumns(), {
      isPrimary: (id) => {
        const column = this.columnById(id);
        return column != null && primarySpecOf(column) != null;
      },
      showLabels: this.resolvedCards().showLabels ?? true,
    }),
  );

  private readonly cardRenderer = computed(() =>
    this.resolveSlot<CardTemplateContext<TRow>>(
      this.cardTemplate()?.template,
      this.slots().card,
      this.resolvedCards().renderer,
    ),
  );

  /**
   * Everything the card list draws, in order: the loaded page, with a heading
   * before each group and a detail region after each open card.
   *
   * The whole page, not a window of it. A card wraps into a flow whose column
   * count follows the container, so `index * height` does not locate one — and
   * a card of stacked fields cannot declare a height for the virtualizer to
   * trust. Paging is what bounds this, which is why an unpaged grid resolving
   * to cards warns in development.
   */
  protected readonly cardItems = computed<DatagridCardItem<TRow>[]>(() => {
    if (!this.cardView()) {
      return [];
    }
    this.renderTick();
    this.selectionVersion();
    // Read unconditionally, for the reason `renderItems` reads it: a pass in
    // which every card is a cache hit would otherwise drop the lookup from
    // this computed's dependencies, and a collection resolving afterwards
    // would leave raw codes on screen forever.
    this.lookupStore.version();

    const result: DatagridCardItem<TRow>[] = [];
    const liveKeys: GridKey[] = [];
    const items = this.bodyItems();
    if (items == null) {
      const rows = this.dataRows();
      const keys = this.rowKeys();
      const offset = this.rowIndexOffset();
      for (const [index, row] of rows.entries()) {
        const key = keys[index];
        result.push(this.cardViewModels.card({ key, row, dataIndex: offset + index }));
        liveKeys.push(key);
        this.pushCardDetail(result, key, row);
      }
      this.cardViewModels.prune(liveKeys);
      return result;
    }
    for (const item of items) {
      switch (item.kind) {
        case 'data':
          result.push(
            this.cardViewModels.card({ key: item.key, row: item.row, dataIndex: item.dataIndex }),
          );
          liveKeys.push(item.key);
          this.pushCardDetail(result, item.key, item.row);
          break;
        case 'group':
          result.push(this.cardViewModels.group(item.node, item.expanded, this.groupSummaries()));
          break;
        // A group footer aligns aggregates under column tracks a card list
        // does not have, and its values already read in the heading. A detail
        // region follows the card it belongs to, which the branch above has
        // already placed — taking it from this list too would draw it twice.
        case 'groupFooter':
        case 'detail':
          break;
      }
    }
    this.cardViewModels.prune(liveKeys);
    return result;
  });

  private pushCardDetail(into: DatagridCardItem<TRow>[], key: GridKey, row: TRow): void {
    if (this.detailRenderer() != null && this.expansionStore.isExpanded(key)) {
      into.push(this.cardViewModels.detail(key, row));
    }
  }

  /**
   * The grid's totals, drawn as a strip under the cards.
   *
   * A footer row would need the column tracks a card list does not have, so
   * every total reads as a labelled value instead — the same shape a group
   * heading uses for its aggregates.
   */
  protected readonly cardSummaries = computed(() =>
    this.cardViewModels.summaryList(this.totalSummaries(), this.dataStore.aggregates()),
  );

  /**
   * Whether the auto-load sentinel is in the DOM.
   *
   * Wider than {@link showLoadMore}, which only draws its button for a source
   * with no total count: a source that reports one still grows by pages in
   * infinite mode, and the scroll is what should grow it.
   */
  protected readonly showLoadSentinel = computed(
    () =>
      this.resolvedPagingMode() === 'infinite' && this.page().hasNext && this.stateKind() == null,
  );

  /** Skeleton cards, sized to the page rather than to a measured viewport. */
  protected readonly skeletonCards = computed(() => {
    if (!this.ready() || !this.initialLoadingVisible() || this.loadingTemplate() != null) {
      return 0;
    }
    return Math.min(6, Math.max(1, this.effectivePageSize()));
  });

  /** Field rows a skeleton card draws, so the placeholder is the card's shape. */
  protected readonly skeletonFields = computed(() =>
    Math.min(4, Math.max(1, this.cardPlan().fields.length)),
  );

  /**
   * The columns the sort menu offers, with the direction in force on each.
   *
   * The menu exists because the card view has no header to sort from. It is
   * offered in both presentations all the same: a host that names it gets it,
   * and the item is the only sort affordance a card list can have.
   */
  private readonly sortMenuColumns = computed<readonly SortMenuColumn[]>(() => {
    if (!this.sortable()) {
      return [];
    }
    const sort = this.sort();
    return this.columnStore
      .visibleColumns()
      .filter((column) => this.permits(column.id, 'sorting'))
      .map((column) => ({
        id: column.id,
        caption: column.caption ?? column.field ?? column.id,
        direction: sortDirectionOf(sort, sortFieldOf(column)),
      }));
  });

  /**
   * Advances one column through ascending, descending and unsorted.
   *
   * Single-key, whatever `multiSort` says: the menu row that would express a
   * second key has to carry a position as well as a direction, and a grid
   * needing that in this presentation binds `sort` itself.
   */
  protected cycleSortColumn(columnId: string): void {
    this.onSortToggled({ columnId, multi: false });
  }

  /** Rebuilt only when the error changes, so the outlet context stays stable. */
  protected readonly errorContextValue = computed(() => {
    const error = this.error();
    return error == null
      ? null
      : {
          $implicit: error,
          retry: (): void => {
            this.reload();
          },
        };
  });

  /**
   * Rows the grid can name a position within, header rows included.
   *
   * A flattened body counts its own entries: group rows and detail regions are
   * rows to assistive technology, and the source's total counts neither. A
   * plain body still reports the whole dataset rather than the window, which
   * is what §16.1 asks for. The filter row is a row too, so it counts.
   */
  private readonly countedRows = computed(() => {
    const items = this.bodyItems();
    const rows = items?.length ?? this.dataStore.totalCount() ?? this.dataRows().length;
    return rows + this.headerRows();
  });

  /**
   * Rows the grid reports, or `-1`.
   *
   * A paged or infinite grid whose source reports no total holds part of the
   * data and knows of no number for the rest. `aria-rowcount` reserves `-1`
   * for exactly that; counting the loaded rows instead would tell assistive
   * technology the current page is the whole dataset.
   */
  protected readonly ariaRowCount = computed(() => {
    if (this.resolvedPagingMode() !== 'none' && this.dataStore.totalCount() == null) {
      return -1;
    }
    return this.countedRows() + (this.hasGridFooter() ? 1 : 0);
  });

  protected readonly ariaColCount = computed(() => this.layout().columns.length);

  /**
   * A grouped or expandable body is a treegrid: rows nest and carry
   * `aria-expanded`, which is what tells a screen reader the arrow keys open
   * something rather than only move.
   */
  protected readonly gridRole = computed(() =>
    this.group().length > 0 || this.detailRenderer() != null ? 'treegrid' : 'grid',
  );

  /** One chip per grouping level, outermost first. */
  protected readonly groupChips = computed<DatagridGroupChip[]>(() => {
    const byField = this.columnsByField();
    return this.group().map((spec, index) => {
      const column = byField.get(spec.field);
      return {
        columnId: column?.id ?? spec.field,
        field: spec.field,
        caption: column?.caption ?? column?.field ?? spec.field,
        desc: spec.desc === true,
        position: index + 1,
      };
    });
  });

  /** The grid's total summary row, one cell per rendered column. */
  protected readonly footerCells = computed<DatagridRenderSummaryCell<TRow>[]>(() =>
    this.rowViewModels.summaryCells(
      this.totalSummaries(),
      this.dataStore.aggregates(),
      null,
      this.layout(),
    ),
  );

  /** The footer sits after every body row, whether or not the total is known. */
  protected readonly footerRowIndex = computed(() => this.countedRows() + 1);

  protected readonly hasActiveFilter = computed(() => {
    const query = this.queryStore.query();
    return query.filter != null || query.search != null;
  });

  /**
   * The page size in force, which is the store's: the pager must divide by
   * the same number the outgoing query carries, whoever last wrote it.
   */
  private readonly effectivePageSize = computed(
    () => this.queryStore.pageSize() ?? normalizePageSize(this.pageSize()) ?? 1,
  );

  /**
   * The sizes the pager offers, without the ones that are not sizes. A
   * fraction or a `NaN` reaching the selector would set a page size the query
   * cannot carry.
   */
  protected readonly resolvedPageSizes = computed(
    () => {
      const declared = this.fromConfig(
        'pageSizes',
        this.pageSizes(),
        (config) => config.paging?.pageSizes,
      );
      const seen = new Set<number>();
      for (const size of declared) {
        const normalized = normalizePageSize(size);
        if (normalized != null) {
          seen.add(normalized);
        }
      }
      return [...seen];
    },
    // A host that writes the sizes inline hands over a new array per change
    // detection. Without this the selector below would rebuild its options
    // every pass, which is a control that flickers under the pointer.
    { equal: structurallyEqual },
  );

  /**
   * The sizes the selector offers, with the size in force among them.
   *
   * A grid paging by 25 and offering 10 and 50 would otherwise draw an empty
   * selector: the control must always name the size the rows are paged by.
   */
  protected readonly pageSizeOptions = computed<readonly SelectOption<number>[]>(() => {
    const offered = this.resolvedPageSizes();
    if (offered.length === 0) {
      return [];
    }
    const sizes = new Set(offered);
    sizes.add(this.effectivePageSize());
    return [...sizes]
      .sort((left, right) => left - right)
      .map((size) => ({ label: String(size), value: size }));
  });

  /** Whether the footer carries a page-size control at all. */
  protected readonly showPageSizes = computed(() => this.pageSizeOptions().length > 0);

  /**
   * Whether the sizes are drawn as buttons rather than gathered into a
   * selector. A size one press away is worth the width wherever the row has
   * it; where it has not, a control that opens is worth more than four that
   * are clipped.
   *
   * The footer is as wide as the viewport above it, so the viewport's
   * measurement is the row's. An unmeasured grid answers with the buttons:
   * that is the wide form, it is what a server render produces, and a first
   * frame that already agrees with it is a footer that does not swap controls
   * under the user.
   */
  protected readonly inlinePageSizes = computed(() => {
    const count = this.pageSizeOptions().length;
    if (count === 0) {
      return false;
    }
    const width = this.viewportWidth();
    return width === 0 || width >= PAGER_MIN_WIDTH + count * PAGE_SIZE_BUTTON_WIDTH;
  });

  /** Pager view model. */
  protected readonly page = computed(() =>
    pageInfo({
      pageIndex: this.queryStore.pageIndex(),
      pageSize: this.effectivePageSize(),
      total: this.dataStore.totalCount(),
      loadedRows: this.dataRows().length,
    }),
  );

  protected readonly showPager = computed(
    () => this.resolvedPagingMode() === 'pager' && this.resolvedRequireTotalCount(),
  );

  /** A source with no total count offers "load more" instead of page links. */
  protected readonly showLoadMore = computed(
    () =>
      this.resolvedPagingMode() !== 'none' &&
      !this.resolvedRequireTotalCount() &&
      this.page().hasNext &&
      this.stateKind() == null,
  );

  /**
   * The replaceable state to render instead of rows, if any. The neutral
   * shell of §3.2 is none of them: a grid still waiting for its columns has
   * nothing to report, and an "empty" message there would accuse the data.
   */
  protected readonly stateKind = computed<DatagridStateKind>(() => {
    if (this.error() != null) {
      return 'error';
    }
    if (!this.ready()) {
      return null;
    }
    if (this.loading() || this.dataRows().length > 0) {
      return null;
    }
    if (!this.dataStore.settled()) {
      return null;
    }
    return this.hasActiveFilter() ? 'noResults' : 'empty';
  });

  protected readonly skeletonRows = computed(() => {
    if (!this.ready() || !this.initialLoadingVisible() || this.loadingTemplate() != null) {
      return 0;
    }
    const height = this.viewportHeight();
    const rowHeight = this.resolvedRowHeight();
    return height > 0 ? Math.min(20, Math.ceil(height / rowHeight)) : 8;
  });

  private readonly resolvedBooleanLabels = computed(() => this.booleanLabels() ?? undefined);

  /** `config.locale.timezone`: the zone dates render in and relative filters count days in. */
  private readonly resolvedTimezone = computed(() =>
    readConfigLayers(this.configLayers(), (config) => config.locale?.timezone),
  );

  /** `config.locale.language`: the language numbers, currencies and dates are formatted in. */
  private readonly resolvedLanguage = computed(() =>
    readConfigLayers(this.configLayers(), (config) => config.locale?.language),
  );

  /**
   * Passed to the header and the filter row, which build their menu labels
   * imperatively — at open time, which is a user action, so the lazy scope has
   * arrived by then. Reads each key through the copy overrides.
   */
  protected readonly translate = (key: string, params?: Record<string, unknown>): string =>
    this.transloco.translate(this.copy(key), params);

  constructor() {
    this.cellLayout.bind({
      widths: computed(
        () => new Map(this.layout().columns.map((entry) => [entry.id, entry.width])),
      ),
      cards: this.cardView,
      density: this.resolvedDensity,
    });
    // Browser only. A server render is one shot, so a gate on the skeleton
    // could only hold the response back, and the rendered HTML carries the
    // rows in any case.
    if (this.isBrowser) {
      this.dataStore.setInitialLoadingFloor(SKELETON_MIN_DURATION);
    }
    // A getter rather than a copy: the first query must already count days in the host's zone.
    this.queryStore.useTimezone(() => this.resolvedTimezone());
    // Every store mutation runs untracked. A store setter reads its own signals
    // to diff before writing, and those reads would otherwise become
    // dependencies of the effect that writes them, retriggering it forever.
    effect(() => {
      const columns = this.resolvedColumns();
      const bands = this.bandIndex().pathOf;
      untracked(() => {
        this.columnStore.setColumns(columns);
        // Before anything reads the order: it is what holds each band's
        // columns together, and an arrangement applied without it would draw
        // a caption spanning columns that are no longer under it.
        this.columnStore.setBandPaths(bands);
        this.seedSort(columns);
        this.seedFilters(columns);
        this.applyDeclaredVisibility(columns);
      });
    });
    // Every local operation reads values through the columns: comparators and
    // custom aggregates off the definitions, and field access off the column
    // that declares the field, so a computed or nested column is filtered,
    // searched and totalled by what it reads rather than by a path that may
    // not exist on the row.
    effect(() => {
      const options = {
        getValue: this.fieldValueGetter(),
        searchFields: this.searchFields(),
        sortResolver: sortResolverFor(this.resolvedColumns()),
        customAggregates: this.localCustomAggregates(),
      };
      untracked(() => {
        this.dataStore.setEngineOptions(options);
      });
    });
    effect(() => {
      const group = this.group();
      untracked(() => {
        this.queryStore.setGroup(group);
      });
    });
    // Total and group aggregates both reach the query: a remote source
    // computes the totals, and a source that groups remotely returns the group
    // aggregates with the groups.
    effect(() => {
      const specs = summaryAggregateSpecs(this.resolvedSummaries());
      untracked(() => {
        this.queryStore.setAggregates(specs);
      });
    });
    effect(() => {
      const expanded = this.resolvedGroupDefaultExpanded();
      untracked(() => {
        this.groupStore.setDefaultExpanded(expanded);
      });
    });
    effect(() => {
      const mode = this.resolvedDetailMode();
      untracked(() => {
        this.expansionStore.setMode(mode);
      });
    });
    effect(() => {
      const keys = this.expandedKeys();
      untracked(() => {
        this.expansionStore.set(keys);
      });
    });
    // The store is the authority: `'single'` mode drops all but one key, and a
    // reload prunes keys that vanished. Without the write-back the model would
    // keep a value the store had already refused.
    effect(() => {
      const keys = this.expansionStore.expandedKeys();
      untracked(() => {
        if (!structurallyEqual(keys, this.expandedKeys())) {
          this.expandedKeys.set(keys);
        }
      });
    });
    effect(() => {
      const spec = this.resolvedKey();
      const fields = spec == null ? [] : keyFields(spec);
      untracked(() => {
        this.columnStore.setKeyFields(fields);
      });
    });
    effect(() => {
      // An absent source is an empty one. The constant keeps the store from
      // seeing a fresh array, which would reset `settled` on every pass.
      const data = this.resolvedData() ?? NO_DATA;
      untracked(() => {
        this.dataStore.setData(data);
        this.settledOnce = false;
        // The row cache deliberately survives. Every entry is revalidated
        // against the row's own identity before it is reused, so a stale one
        // cannot render — and keeping it is what lets the flash see the
        // previous value when a host pushes live data by replacing the array.
        this.queryStore.reload();
      });
    });
    effect(() => {
      const filter = this.filter();
      untracked(() => {
        this.queryStore.setFilter(filter);
      });
    });
    effect(() => {
      const filter = this.resolvedBaseFilter();
      untracked(() => {
        this.queryStore.setBaseFilter(filter);
      });
    });
    effect(() => {
      const search = this.search();
      untracked(() => {
        this.queryStore.setSearch(search);
      });
    });
    // The store is the authority on both: `clearFilters()` empties them from
    // the panel, the API and the no-results state, and a model left holding
    // the old value would make the host's next write an equal one — which
    // schedules nothing. Both setters compare before writing, so the pair
    // converges instead of ringing.
    effect(() => {
      const filter = this.queryStore.filter();
      untracked(() => {
        if (!structurallyEqual(filter, this.filter())) {
          this.filter.set(filter);
        }
      });
    });
    effect(() => {
      const search = this.queryStore.search();
      untracked(() => {
        if (search !== this.search()) {
          this.search.set(search);
        }
      });
    });
    effect(() => {
      const sort = this.sort();
      untracked(() => {
        this.queryStore.setSort(sort);
      });
    });
    effect(() => {
      const enabled = this.projection();
      const projection = this.columnStore.projection();
      untracked(() => {
        if (enabled) {
          this.queryStore.setProjection(projection.select, projection.expand);
        } else {
          this.queryStore.setProjection(null, null);
        }
      });
    });
    effect(() => {
      const mode = this.resolvedPagingMode();
      const size = this.pageSize();
      const requireTotal = this.resolvedRequireTotalCount();
      const minRefresh = this.resolvedRefreshMinDuration();
      untracked(() => {
        this.dataStore.setAccumulation(mode === 'infinite' ? 'accumulate' : 'replace');
        this.dataStore.setMinRefreshDuration(minRefresh);
        this.queryStore.setPageSize(mode === 'none' ? null : size);
        this.queryStore.setRequireTotalCount(requireTotal);
        // A different way of reading the list starts at its beginning. Going to
        // cards on page three would otherwise accumulate from row 51 with the
        // first fifty unreachable — there is no pager left to go back with —
        // and coming back would leave three pages stitched under one.
        // The first resolution is not a change: a restored arrangement carries
        // its own page, and resetting here would drop it.
        if (this.lastPagingMode !== null && this.lastPagingMode !== mode) {
          this.queryStore.setPageIndex(0);
        }
        this.lastPagingMode = mode;
      });
    });
    effect(() => {
      const index = this.pageIndex();
      untracked(() => {
        this.queryStore.setPageIndex(index);
      });
    });
    // The store is the authority on the page index: sorting, filtering and a
    // page-size change all snap it back to the first page on their own. Without
    // this write-back the model would keep the stale index, and the next pager
    // click would set the model to a value it already held — an equal write,
    // which schedules nothing, leaving the grid stuck on page one.
    effect(() => {
      const index = this.queryStore.pageIndex();
      untracked(() => {
        if (this.pageIndex() !== index) {
          this.pageIndex.set(index);
        }
      });
    });
    effect(() => {
      const mode = this.resolvedSelectionMode();
      untracked(() => {
        this.selectionStore.setMode(mode);
      });
    });
    // Hidden ids are the whole of user-driven visibility. A column absent from
    // the list keeps whatever its definition declared.
    effect(() => {
      const hidden = new Set(this.hiddenColumns());
      untracked(() => {
        this.columnStore.setHiddenIds(hidden);
      });
    });
    // Anything that changes how a row renders, but is not the row's own data,
    // invalidates every cached view model. The directive maps, not the
    // resolved renderers: those also move with a column's width, and clearing
    // the cache on every drag frame would throw away the flash history that
    // only the cache holds. A renderer arriving on a `ColumnDef` comes with a
    // new columns array, which invalidates through the layout identity.
    effect(() => {
      this.cellTemplates();
      this.headerTemplates();
      this.slots();
      this.resolvedDecorateRow();
      this.resolvedDecorateCell();
      this.resolvedBooleanLabels();
      // A lookup resolves after the first paint, so the cells drawn before it
      // arrived hold the raw stored value and have to be built again.
      this.lookupStore.version();
      untracked(() => {
        this.rowViewModels.invalidateAll();
      });
    });
    // Lookups load once per column and are kept for the life of the grid: a
    // reference collection re-fetched because a row scrolled into view is the
    // request-per-row §5.3 forbids.
    effect(() => {
      const columns = this.resolvedColumns();
      untracked(() => {
        for (const column of columns) {
          if (column.lookup != null) {
            this.lookupStore.ensure(column.id, column.lookup);
          }
        }
      });
    });
    // Values the loaded collection does not cover are resolved by key, for a
    // source that offers it. Driven by the loaded rows and not by the rendered
    // window: `rows()` changes once per load, so this is one request per load
    // per column, while a scroll costs nothing.
    effect(() => {
      const rows = this.dataStore.rows();
      const columns = this.resolvedColumns();
      untracked(() => {
        if (rows.length === 0) {
          return;
        }
        for (const column of columns) {
          if (column.lookup == null) {
            continue;
          }
          const values = rows.map((row) => resolveCellValue(row, column));
          void this.lookupStore.resolveValues(column.id, values);
        }
      });
    });
    // The projection the rows on screen were loaded with. Recorded when rows
    // land, so a column shown before its reload is not yet counted as loaded.
    effect(() => {
      this.dataStore.rows();
      untracked(() => {
        this.loadedSelect.set(
          this.projectsLoads() ? (this.queryStore.query().select ?? null) : null,
        );
      });
    });
    // A field that resolves on no row renders an empty cell and reads as
    // missing data. Reported once per column, in development only. Only the
    // columns the rows were loaded for: a projected load leaves out the fields
    // of hidden columns on purpose.
    effect(() => {
      const first = this.dataStore.rows()[0];
      const select = this.loadedSelect();
      const columns = this.resolvedColumns();
      untracked(() => {
        if (first !== undefined) {
          checkColumnFields(
            columns.filter((column) => projectionCovers(select, column.field)),
            first,
            this.reportedFields,
          );
        }
      });
    });
    effect(() => {
      const error = this.dataStore.error();
      if (error != null) {
        untracked(() => {
          this.emitEvent('loadFailed', { error });
          this.emitEvent('error', { error });
        });
      }
    });
    // Focus follows the data by key. It is deliberately not re-asserted in the
    // DOM: a background refresh must never pull focus from elsewhere.
    effect(() => {
      const keys = this.focusKeys();
      const columnIds = this.layout().columns.map((entry) => entry.id);
      // The focused cell is read untracked and written back here, so tracking
      // it would make this effect retrigger itself forever.
      const current = untracked(() => this.focusStore.cell());
      const next = reconcileFocus(current, {
        previousKeys: this.previousKeys,
        nextKeys: keys,
        columnIds,
      });
      this.previousKeys = keys;
      if (next?.key !== current?.key || next?.columnId !== current?.columnId) {
        this.focusStore.set(next);
      }
    });
    // Selection survives a reload by key. `'drop'` prunes what vanished —
    // including when everything vanished, which is why the guard is the
    // settled load and not the row count: an empty result means every key is
    // missing, not that there is nothing to prune.
    effect(() => {
      const keys = this.rowKeys();
      const policy = this.resolvedMissingKeys();
      const resolved = this.ready() && this.dataStore.settled();
      untracked(() => {
        if (policy === 'drop' && resolved) {
          this.selectionStore.retainKeys(new Set(keys));
        }
      });
    });
    // A detail region whose row is gone has nothing to show, so expansion is
    // pruned unconditionally rather than by policy.
    effect(() => {
      const keys = this.rowKeys();
      const resolved = this.ready() && this.dataStore.settled();
      untracked(() => {
        if (resolved) {
          this.expansionStore.retainKeys(new Set(keys));
        }
      });
    });
    // The selection model writes back out, so a host can bind it. The event
    // is distinct: a vetoed change writes the store twice and settles back on
    // the value it started from, which is not a change.
    let selectionSeeded = false;
    effect(() => {
      const snapshot = this.selectionStore.selection();
      untracked(() => {
        this.selectedKeys.set(snapshot.kind === 'keys' ? snapshot.keys : []);
        if (selectionSeeded) {
          this.emitDistinctEvent('selectionChanged', { selection: snapshot });
        } else {
          selectionSeeded = true;
          this.events.seed('selectionChanged', { selection: snapshot });
        }
      });
    });
    this.setUpAnnouncements();
    this.setUpInfiniteScroll();
    this.setUpEvents();
    this.seedModelsFromConfig();
    // Before the data store is connected: the restore flag has to be up by the
    // time the first query would be issued, and effects run in creation order.
    this.setUpState();
    this.setUpAutoRefresh();
    // The saved arrangement holds the first query back, so its wait is part of
    // the first load to the reader and the skeleton covers it.
    effect(() => {
      if (this.stateSync.restoring()) {
        untracked(() => {
          this.dataStore.reportInitialLoad();
        });
      }
    });

    connectDataStore(this.queryStore, this.dataStore, this.injector, {
      enabled: () => !this.stateSync.restoring(),
    });

    effect((onCleanup) => {
      const ref = this.apiRef();
      if (ref == null) {
        return;
      }
      untracked(() => {
        ref.set(this.gridApi);
      });
      onCleanup(() => {
        untracked(() => {
          ref.set(null);
        });
      });
    });

    this.destroyRef.onDestroy(() => {
      // A settled arrangement is saved before the flag goes up, or a grid
      // destroyed inside the debounce loses the change that destroyed it.
      this.stateSync.flushPending();
      this.destroyed = true;
      if (this.filterTimer != null) {
        clearTimeout(this.filterTimer);
      }
      this.headerFilter.close();
      this.dataStore.cancelDistinctLoad();
      void this.filterBuilderOverlay?.ref.close();
    });

    afterNextRender(() => {
      const element = this.viewportRef()?.nativeElement;
      if (element == null) {
        return;
      }
      this.measure(element);
      this.applyPendingScroll(element);
      // Emitted here rather than in the constructor: a parent's output
      // bindings are not connected until its view has been created.
      this.emitEvent('initialized', { api: this.gridApi });
      if (typeof ResizeObserver === 'undefined') {
        return;
      }
      const observer = new ResizeObserver(() => {
        this.measure(element);
      });
      observer.observe(element);
      this.destroyRef.onDestroy(() => {
        observer.disconnect();
      });
    });

    // The request is what asks for DOM focus, not the position. This effect
    // also re-runs when the position changes, and reconciliation after a data
    // change changes it — so without the guard, a filter that narrows the rows
    // to one pulls focus out of the editor the user is typing in and onto the
    // surviving row. Every deliberate move goes through `FocusStore.focus`,
    // which bumps the request; the header re-asserts its own focus itself.
    afterRenderEffect(() => {
      const request = this.focusStore.focusRequest();
      const cell = this.focusStore.cell();
      if (request === 0 || request === this.appliedFocusRequest || cell == null) {
        return;
      }
      this.appliedFocusRequest = request;
      this.applyDomFocus(cell);
    });

    afterRenderEffect(() => {
      // The card view has no column tracks to slide, and re-arranging columns
      // there changes which fields a card draws rather than where they sit.
      if (!this.cardView()) {
        this.columnFlip.play(this.viewportRef()?.nativeElement, this.layout());
      }
    });

    // The sentinel comes and goes with the next page, so this re-runs whenever
    // either element changes. `connect` is idempotent for an unchanged pair.
    afterRenderEffect(() => {
      const root = this.viewportRef()?.nativeElement;
      const sentinel = this.loadSentinelRef()?.nativeElement;
      if (root == null || sentinel == null) {
        this.autoLoad.disconnect();
        return;
      }
      this.autoLoad.connect(root, sentinel);
    });

    // One page is often shorter than the space below the fold, which leaves
    // the sentinel exactly where it was — and an observer reports a crossing,
    // not a state. Without this the list would grow by one page and stop.
    afterRenderEffect(() => {
      if (!this.loading()) {
        untracked(() => {
          this.autoLoad.poll();
        });
      }
    });

    // The card list draws every loaded row, so an unpaged grid over a large
    // dataset renders all of it. Reported once: the fix is a paging mode, and
    // repeating it per render would bury it.
    effect(() => {
      if (
        isDevMode() &&
        this.cardView() &&
        this.resolvedPagingMode() === 'none' &&
        this.dataRows().length > CARD_UNPAGED_WARNING_ROWS &&
        !this.warnedUnpagedCards
      ) {
        this.warnedUnpagedCards = true;
        console.warn(
          `datagrid: the card view renders every loaded row and this grid has ${this.dataRows().length.toString()} with paging off. Set pagingMode to "pager" or "infinite".`,
        );
      }
    });
  }

  /** Reported once per grid: see the effect that sets it. */
  private warnedUnpagedCards = false;

  /** The paging mode the query was last configured for. See the effect that reads it. */
  private lastPagingMode: PagingMode | null = null;

  /**
   * Whether the sentinel may start the next page.
   *
   * Deliberately narrower than {@link loadMore}: an automatic load is only
   * ever an anticipation of the affordance the user can see, so it waits for
   * the grid to be idle and refuses while a replaceable state is on screen.
   */
  private canAutoLoad(): boolean {
    return (
      this.resolvedPagingMode() === 'infinite' &&
      !this.loading() &&
      this.page().hasNext &&
      this.stateKind() == null
    );
  }

  /**
   * Records which inputs the template binds.
   *
   * `ngOnChanges` fires for signal inputs as well, and it is the only honest
   * answer to "did the host bind this": a value equal to the default cannot be
   * told from an absent binding by looking at it.
   */
  ngOnChanges(changes: SimpleChanges): void {
    const names = Object.keys(changes);
    this.boundInputs.update((current) => {
      const missing = names.filter((name) => !current.has(name));
      return missing.length === 0 ? current : new Set([...current, ...missing]);
    });
  }

  /**
   * Copies config keys into the models that own them.
   *
   * A `model()` cannot be a computed over the config: the pager writes the
   * page size and the indicator writes the interval, and a computed would
   * throw those away on the next pass. So the config seeds them instead, and
   * re-seeds when its value genuinely changes — an equal value is a no-op,
   * which is what §3.2 asks of a rebuilt config object.
   */
  private readonly configSeeds = new Map<string, unknown>();

  private seedModelsFromConfig(): void {
    effect(() => {
      const layers = this.configLayers();
      const bound = this.boundInputs();
      untracked(() => {
        this.seedModel(
          bound,
          layers,
          'pageSize',
          (config) => config.paging?.pageSize,
          this.pageSize,
        );
        this.seedModel(
          bound,
          layers,
          'autoRefresh',
          (config) => config.refresh?.auto,
          this.autoRefresh,
        );
        this.seedModel(
          bound,
          layers,
          'autoRefreshInterval',
          (config) => config.refresh?.interval,
          this.autoRefreshInterval,
        );
      });
    });
  }

  private seedModel<TValue>(
    bound: ReadonlySet<string>,
    layers: readonly ConfigLayer<TRow>[],
    name: string,
    read: (config: Partial<GridConfig<TRow>>) => TValue | undefined,
    target: { set(value: TValue): void },
  ): void {
    if (bound.has(name)) {
      return;
    }
    const value = readConfigLayers(layers, read);
    if (value === undefined || Object.is(this.configSeeds.get(name), value)) {
      return;
    }
    this.configSeeds.set(name, value);
    target.set(value);
  }

  // --- Events ----------------------------------------------------------

  /**
   * Dispatches one event to the bus, the aggregate stream and the granular
   * output, then returns the payload so a caller can read a veto.
   *
   * The three go out from one call so a host cannot observe one without the
   * others, and they go out synchronously: a handler that sets `canceled`
   * has done so by the time this returns.
   */
  private emitEvent<K extends GridEventName>(
    name: K,
    payload: GridEventMap<TRow>[K],
  ): GridEventMap<TRow>[K] {
    this.events.emit(name, payload);
    this.granular[name]?.(payload);
    // The union cannot be proved from a generic `K`, only from a literal one.
    this.gridEvent.emit({ name, payload } as GridEvent<TRow>);
    return payload;
  }

  /** As {@link emitEvent}, but silent when the payload repeats the last one. */
  private emitDistinctEvent<K extends GridEventName>(
    name: K,
    payload: GridEventMap<TRow>[K],
  ): void {
    if (this.events.emitDistinct(name, payload)) {
      this.granular[name]?.(payload);
      this.gridEvent.emit({ name, payload } as GridEvent<TRow>);
    }
  }

  /**
   * Emits whenever a facet changes — never on the first read, which reports
   * the initial state rather than a change to it.
   */
  private emitOnChange<K extends GridEventName>(
    name: K,
    payload: () => GridEventMap<TRow>[K],
  ): void {
    let seeded = false;
    effect(() => {
      const value = payload();
      untracked(() => {
        if (seeded) {
          this.emitDistinctEvent(name, value);
          return;
        }
        seeded = true;
        this.events.seed(name, value);
      });
    });
  }

  private setUpEvents(): void {
    this.emitOnChange('queryChanged', () => ({ query: this.queryStore.query() }));
    this.emitOnChange('dataChanged', () => {
      const total = this.dataStore.totalCount();
      const rows = this.dataRows();
      return total == null ? { rows } : { rows, totalCount: total };
    });
    this.emitOnChange('sortChanged', () => ({ sort: this.sort() }));
    this.emitOnChange('groupChanged', () => ({ group: this.group() }));
    this.emitOnChange('filterChanged', () => ({ filter: this.queryStore.userFilter() }));
    this.emitOnChange('pageChanged', () => ({ pageIndex: this.queryStore.pageIndex() }));
    this.emitOnChange('pageSizeChanged', () => ({ pageSize: this.pageSize() }));
    // Fired once per data source identity: `settledOnce` resets when `data`
    // changes, which is also when the store drops its own settled flag.
    // Gated on `ready` as well as on the result, because the event contract
    // promises the configuration has been applied — and a fast source can
    // settle before the columns and the key arrive.
    effect(() => {
      const settled = this.dataStore.settled() && this.ready();
      untracked(() => {
        if (settled && !this.settledOnce) {
          this.settledOnce = true;
          this.emitEvent('firstSettled', {});
        }
      });
    });
    // Visibility is reported by diffing the hidden set, so the chooser, the
    // header menu and the API all report through one path.
    effect(() => {
      const hidden: ReadonlySet<string> = new Set(this.hiddenColumns());
      untracked(() => {
        if (!this.hiddenSeeded) {
          this.hiddenSeeded = true;
          this.lastHidden = hidden;
          return;
        }
        for (const id of hidden) {
          if (!this.lastHidden.has(id)) {
            this.emitEvent('columnVisibilityChanged', { columnId: id, visible: false });
          }
        }
        for (const id of this.lastHidden) {
          if (!hidden.has(id)) {
            this.emitEvent('columnVisibilityChanged', { columnId: id, visible: true });
          }
        }
        this.lastHidden = hidden;
      });
    });
  }

  // --- Imperative API ---------------------------------------------------

  /**
   * The half of {@link GridApi} the shipped milestones implement. Everything
   * else is filled in by {@link createGridApi} and throws until its milestone
   * lands, so the object's shape never changes.
   */
  private apiHost(): GridApiHost<TRow> {
    return this.markProgrammatic({
      reload: () => {
        this.reload();
      },
      reset: () => {
        this.resetArrangement();
      },
      applyQuery: (query) => {
        this.applyQuery(query);
      },
      getQuery: () => this.queryStore.query(),
      getRows: () => this.dataStore.rows(),
      getRow: (key) => this.rowFor(key),
      getTotalCount: () => this.dataStore.totalCount() ?? undefined,
      refreshRow: (key) => {
        this.rowViewModels.invalidate(key);
        this.renderTick.update((tick) => tick + 1);
      },
      applyTransaction: (transaction) => {
        this.applyTransaction(transaction);
      },
      getColumns: () => this.columnStore.columns(),
      getVisibleColumns: () => this.columnStore.visibleColumns(),
      setColumnVisible: (id, visible) => {
        this.applyColumnVisible(id, visible);
      },
      setColumnWidth: (id, width) => {
        this.applyColumnWidth(id, width);
      },
      moveColumn: (id, index) => {
        this.applyColumnMove(id, index);
      },
      autoSizeColumns: () => {
        this.autoSizeColumns();
      },
      pinColumn: (id, side) => {
        this.applyColumnPin(id, side);
      },
      getState: (options) => this.gridState(options),
      // A saved arrangement is applied through here even in a read-only
      // presentation — that is what §3.3's "the same config, a saved
      // arrangement bound one-way" means, so `stateChange` gates the user's
      // rearrangement and the persistence write, never the host's apply.
      setState: (state) => this.applyState(state, 'programmatic'),
      resetState: () => {
        this.resetArrangement();
      },
      openTemporaryView: (view) => {
        this.viewsController.openTemporary(view);
      },
      closeTemporaryView: () => {
        this.viewsController.closeTemporary();
      },
      isDirty: (reference) => !gridStatesEqual(this.gridState(), reference),
      getFilter: () => this.queryStore.userFilter(),
      setFilter: (node) => {
        if (this.permitsCapability('filtering')) {
          this.filter.set(node);
        }
      },
      clearFilters: () => {
        if (this.permitsCapability('filtering')) {
          this.clearAllFilters();
        }
      },
      getColumnFilter: (columnId) => this.queryStore.columnFilters().get(columnId) ?? null,
      setColumnFilter: (columnId, node) => {
        if (!this.permits(columnId, 'filtering')) {
          return;
        }
        this.clearColumnEditor(columnId);
        this.queryStore.setRelativeDateFilter(columnId, null);
        const column = this.columnById(columnId);
        if (column === undefined) {
          this.queryStore.setColumnFilter(columnId, node);
          return;
        }
        this.setColumnFilterNode(column, node);
      },
      clearColumnFilter: (columnId) => {
        if (this.permitsCapability('filtering')) {
          this.clearColumnFilter(columnId);
        }
      },
      getHeaderFilter: (columnId) => this.queryStore.headerFilters().get(columnId) ?? null,
      setHeaderFilter: (columnId, node) => {
        if (this.permits(columnId, 'headerFiltering')) {
          this.queryStore.setHeaderFilter(columnId, node);
        }
      },
      clearHeaderFilter: (columnId) => {
        if (this.permitsCapability('filtering')) {
          this.queryStore.setHeaderFilter(columnId, null);
        }
      },
      getSearch: () => this.queryStore.search(),
      setSearch: (term) => {
        if (this.permitsCapability('filtering')) {
          this.search.set(term);
        }
      },
      getSort: () => this.sort(),
      setSort: (spec) => {
        if (this.permitsCapability('sorting')) {
          this.sort.set(spec);
        }
      },
      getGroup: () => this.group(),
      setGroup: (spec) => {
        if (this.permitsCapability('grouping')) {
          this.setGroup(spec);
        }
      },
      expandGroup: (path) => {
        this.groupStore.expand(path);
      },
      collapseGroup: (path) => {
        this.groupStore.collapse(path);
      },
      expandAllGroups: () => {
        this.groupStore.expandAll();
      },
      collapseAllGroups: () => {
        this.groupStore.collapseAll();
      },
      expandRow: (key) => {
        this.setRowExpanded(key, true);
      },
      collapseRow: (key) => {
        this.setRowExpanded(key, false);
      },
      getExpandedKeys: () => this.expansionStore.expandedKeys(),
      getSelectedKeys: () => this.selectionStore.selectedKeys(),
      getSelectedRows: () =>
        this.selectionStore
          .selectedKeys()
          .map((key) => this.rowFor(key))
          .filter((row): row is TRow => row !== undefined),
      setSelectedKeys: (keys) => {
        if (!this.permitsCapability('selection')) {
          return;
        }
        this.changeSelection(() => {
          this.selectionStore.setSelectedKeys(keys);
        });
      },
      clearSelection: () => {
        this.clearSelection();
      },
      selectAllMatching: () => {
        this.selectAllMatching();
      },
      getSelection: () => this.selectionStore.selection(),
      focusCell: (key, columnId) => {
        this.focusCell({ key, columnId });
      },
      getFocusedCell: () => this.focusStore.cell(),
      scrollToRow: (key) => {
        const index = this.itemIndexByKey().get(key);
        if (index !== undefined) {
          this.revealRow(index);
        }
      },
      scrollToColumn: (id) => {
        this.revealColumn(id);
      },
      getScrollPosition: () => ({ top: this.scrollTop(), left: this.scrollLeft() }),
      setScrollPosition: (position) => {
        this.applyScrollPosition(position);
      },
      export: (format, options) => this.exportGrid(format, options),
      copyToClipboard: (options) => this.copySelection(options),
      print: () => {
        this.printGrid();
      },
      repaint: () => {
        this.rowViewModels.invalidateAll();
        this.renderTick.update((tick) => tick + 1);
      },
    });
  }

  /**
   * Marks the arrangement changes an API call produces as programmatic.
   *
   * §14.3 asks the state event to distinguish the user's changes from the
   * host's, and the difference is which door the change came through — not
   * which facet it touched. The flag is read by the state effect a
   * change-detection pass later, which is the same mechanism `applyState`
   * uses.
   */
  private markProgrammatic(host: GridApiHost<TRow>): GridApiHost<TRow> {
    const stateful = [
      'reset',
      'applyQuery',
      'setColumnVisible',
      'setColumnWidth',
      'moveColumn',
      'pinColumn',
      'resetState',
      'openTemporaryView',
      'closeTemporaryView',
      'setFilter',
      'setColumnFilter',
      'setHeaderFilter',
      'clearHeaderFilter',
      'clearColumnFilter',
      'clearFilters',
      'setSearch',
      'setSort',
      'setGroup',
    ] as const satisfies readonly (keyof GridApiHost<TRow>)[];
    const methods = host as unknown as Record<string, (...args: never[]) => unknown>;
    for (const name of stateful) {
      const method = methods[name];
      methods[name] = (...args: never[]): unknown => {
        this.stateSync.markOrigin('programmatic');
        return method(...args);
      };
    }
    return host;
  }

  // --- Grid state -------------------------------------------------------

  /**
   * The values no store owns: the scroll offsets are the viewport's and the
   * focused cell is the view's. Excluded from a state unless it is asked for.
   */
  private readonly volatileAccess: GridVolatileAccess = {
    read: (): GridVolatileState => ({
      pageIndex: this.queryStore.pageIndex(),
      scroll: { top: this.scrollTop(), left: this.scrollLeft() },
      selectedKeys: this.selectionStore.selectedKeys(),
      expandedKeys: this.expansionStore.expandedKeys(),
      focusedCell: this.focusStore.cell(),
    }),
    write: (volatile) => {
      if (volatile.selectedKeys != null) {
        this.selectionStore.setSelectedKeys(volatile.selectedKeys);
      }
      if (volatile.expandedKeys != null) {
        this.expansionStore.set(volatile.expandedKeys);
      }
      if (volatile.pageIndex != null) {
        this.pageIndex.set(volatile.pageIndex);
      }
      if (volatile.focusedCell != null) {
        this.focusStore.set(volatile.focusedCell);
      }
      if (volatile.scroll != null) {
        this.applyScrollPosition(volatile.scroll);
      }
    },
  };

  private readonly stateStores = () => ({
    columns: this.columnStore,
    query: this.queryStore,
    volatile: this.volatileAccess,
  });

  private gridState(options?: GridStateOptions): GridState {
    return serializeGridState(this.stateStores(), options);
  }

  /**
   * The arrangement as a signal, so a change to any facet is a change to it.
   * Volatile values are left out deliberately: recomputing this on every
   * scroll frame would report a state change per frame.
   */
  private readonly currentState = computed(() => this.gridState());

  /** The views feature descriptor, or `null` when the host did not opt in. */
  private readonly viewsFeature = computed(() => findFeature(this.features(), 'views'));

  /** The document the views strip reads and writes, suffixed by the library. */
  private readonly viewsKey = computed(() => {
    const feature = this.viewsFeature();
    return feature == null ? null : savedViewsResourceKey(feature.key);
  });

  /**
   * Named views (§14.4).
   *
   * Constructed whichever way the feature is set, because the fields it holds
   * are four empty signals; nothing is fetched and the strip's chunk is not
   * touched until {@link persistence} resolves to its adapter.
   */
  private readonly viewsController = new GridViewsController({
    key: () => this.viewsKey(),
    storage: () => this.injectedViewsStorage,
    state: () => this.currentState(),
    apply: (state) => {
      this.applyState(state, 'programmatic');
    },
    reset: () => {
      this.resetArrangement();
    },
    temporary: () => this.viewsFeature()?.temporary?.() ?? null,
    isDestroyed: () => this.destroyed,
  });

  /**
   * The bound adapter, or the application's — unless views are on, which take
   * the arrangement over entirely.
   *
   * One saved arrangement, in one place. With both live, the two would race on
   * the first load and the precedence between them would be a rule nobody
   * could predict from the call site.
   */
  private readonly persistence = computed<GridStatePersistence | null>(() =>
    this.viewsFeature() == null
      ? (this.statePersistence() ?? this.injectedPersistence)
      : this.viewsController.persistence,
  );

  /** Two-way sync of the arrangement: the `state` model and the saved copy. */
  private readonly stateSync = new GridStateSync({
    adapter: () => this.persistence(),
    // Views name their own document, so a grid that turns them on needs no
    // `stateKey` of its own. An explicit one still answers for the adapter
    // path, which is the only path left when views are off.
    stateKey: () => this.viewsKey() ?? this.stateKey(),
    canPersist: () => this.allows('stateChange'),
    isDestroyed: () => this.destroyed,
    snapshot: () => this.gridState(),
    apply: (state, origin) => {
      this.applyState(state, origin);
    },
    publish: (state) => {
      this.state.set(state);
    },
    settled: (state, origin) => {
      this.emitEvent('stateChanged', { state, origin });
    },
  });

  private setUpState(): void {
    // Restoring is created before `connectDataStore`, so the flag is up before
    // the first query would have gone out.
    effect(() => {
      this.persistence();
      this.stateKey();
      untracked(() => {
        void this.stateSync.restore();
      });
    });
    effect(() => {
      // Not seeded until the columns are in: a state written before them
      // describes a grid with no columns, and the host would be handed it.
      const ready = this.ready();
      const state = this.currentState();
      untracked(() => {
        if (ready) {
          this.stateSync.report(state);
        }
      });
    });
    effect(() => {
      const incoming = this.state();
      untracked(() => {
        this.stateSync.acceptHostState(incoming);
      });
    });
  }

  /**
   * Applies a state and re-syncs the models the stores do not own. Sort and
   * hidden columns are two-way bindings; leaving them stale would make the
   * next host write an equal one, which schedules nothing.
   */
  private applyState(state: GridState, origin: ChangeOrigin = 'programmatic'): ApplyStateReport {
    this.stateSync.markOrigin(origin);
    const migrate = this.stateMigration();
    const report = applyGridState(
      this.stateStores(),
      state,
      migrate == null ? undefined : { migrate },
    );
    if (report.applied) {
      this.sort.set(this.queryStore.sort());
      this.group.set(this.queryStore.group());
      // Read back off the store rather than off the state: a migration hook
      // may have rewritten the entries, and the store holds what was applied.
      this.hiddenColumns.set(
        this.columnStore
          .columns()
          .filter((column) => column.visible === false)
          .map((column) => column.id),
      );
      // The pager reads the model and the query reads the store, so a restored
      // page size has to land in both or the grid requests one size while
      // paginating by another.
      const pageSize = this.queryStore.pageSize();
      if (pageSize != null) {
        this.pageSize.set(pageSize);
      }
      // The editors describe the filters the state replaced, so they are
      // dropped and re-derived from the nodes the state brought.
      this.pendingFilters.set(new Set());
      this.filterEditors.set(new Map());
    }
    return report;
  }

  /** Merges query facets and re-loads once: the writes collapse into one pass. */
  private applyQuery(query: Partial<Query>): void {
    const caps = this.caps();
    if (query.filter !== undefined && caps.filtering) {
      this.queryStore.setFilter(query.filter);
    }
    if (query.search !== undefined && caps.filtering) {
      this.queryStore.setSearch(query.search ?? null);
    }
    if (query.sort !== undefined && caps.sorting) {
      this.sort.set(query.sort);
    }
    if (query.aggregates !== undefined) {
      this.queryStore.setAggregates(query.aggregates);
    }
    if (query.requireTotalCount !== undefined) {
      this.queryStore.setRequireTotalCount(query.requireTotalCount);
    }
    if (query.take !== undefined && query.take > 0 && caps.paging) {
      this.pageSize.set(query.take);
      if (query.skip !== undefined) {
        this.pageIndex.set(Math.floor(query.skip / query.take));
      }
    }
  }

  /**
   * Re-runs the current query (§12).
   *
   * Relative date filters are re-evaluated against the current instant, and
   * scroll, selection, expansion and focus all survive: they are keyed, and a
   * row that comes back unchanged keeps its identity, so nothing is torn down.
   */
  reload(): void {
    this.emitEvent('refreshRequested', {});
    this.queryStore.reload();
  }

  /**
   * Applies keyed inserts, updates and removes without a query (§12).
   *
   * Only the rows the transaction names lose their cached view model, so the
   * re-render is proportional to the change. A known total moves by the rows
   * that arrived or left, so the pager and `aria-rowcount` stay truthful until
   * the next load.
   */
  applyTransaction(transaction: RowTransaction<TRow>): void {
    const keyOf = this.keyGetter();
    if (keyOf == null) {
      return;
    }
    const result = applyRowTransaction(this.dataStore.rows(), transaction, keyOf);
    if (result.rows === this.dataStore.rows()) {
      return;
    }
    for (const key of [...result.updated, ...result.removed]) {
      this.rowViewModels.invalidate(key);
    }
    this.dataStore.setRows(result.rows, {
      totalDelta: result.inserted.length - result.removed.length,
    });
    if (isDevMode() && result.missing.length > 0) {
      console.warn(
        `datagrid: applyTransaction named ${result.missing.length.toString()} rows that are not loaded.`,
      );
    }
  }

  /** Returns column arrangement and query facets to their initial values. */
  resetArrangement(): void {
    if (!this.permitsCapability('stateChange')) {
      return;
    }
    this.stateSync.forget();
    this.columnStore.reset();
    this.queryStore.reset();
    this.applyInputOwnedFacets();
    this.pendingFilters.set(new Set());
    this.filterEditors.set(new Map());
    // Back to what the definitions declare, which the hidden set now carries
    // in full — an empty set would show a column the columns hid.
    this.hiddenColumns.set(
      this.resolvedColumns()
        .filter((column) => column.visible === false)
        .map((column) => column.id),
    );
    this.sortSeeded = false;
    this.filtersSeeded = false;
    this.sort.set([]);
    this.group.set([]);
    this.groupStore.reset();
    this.seedSort(this.resolvedColumns());
    this.seedFilters(this.resolvedColumns());
  }

  /**
   * Writes back the query facets the inputs own rather than the user.
   *
   * `QueryStore.reset()` returns every facet to the store's construction-time
   * defaults, and the input-owned ones never were those: the effects that copy
   * them in track the inputs, so an unchanged input does not restore them. A
   * reset would otherwise drop an invisible `baseFilter` — a tenant or scope
   * constraint, in the worst case — along with paging, the summary aggregates
   * and a host's `requireTotalCount="false"`. Every write lands in the same
   * synchronous batch, so the reset still issues one query.
   */
  private applyInputOwnedFacets(): void {
    this.queryStore.setBaseFilter(this.resolvedBaseFilter());
    this.queryStore.setPageSize(this.resolvedPagingMode() === 'none' ? null : this.pageSize());
    this.queryStore.setAggregates(summaryAggregateSpecs(this.resolvedSummaries()));
    this.queryStore.setRequireTotalCount(this.resolvedRequireTotalCount());
  }

  // --- Auto-refresh ------------------------------------------------------

  /** Milliseconds between automatic refreshes. Never zero, which would spin. */
  protected readonly resolvedRefreshInterval = computed(() => {
    const declared = this.fromConfig(
      'autoRefreshInterval',
      this.autoRefreshInterval(),
      (config) => config.refresh?.interval,
    );
    return Number.isFinite(declared) && declared >= 1000
      ? Math.round(declared)
      : DEFAULT_REFRESH_INTERVAL;
  });

  /**
   * How long a refresh takes at the least. The floor is what makes the
   * spinning icon and the bar legible when the endpoint answers in less.
   */
  protected readonly resolvedRefreshMinDuration = computed(() => {
    const declared = this.fromConfig<number>(
      'refreshMinDuration',
      DEFAULT_REFRESH_MIN_DURATION,
      (config) => config.refresh?.minDuration,
    );
    return Number.isFinite(declared) && declared >= 0
      ? Math.round(declared)
      : DEFAULT_REFRESH_MIN_DURATION;
  });

  protected readonly resolvedRefreshIntervals = computed(() => {
    const declared = this.fromConfig(
      'autoRefreshIntervals',
      this.autoRefreshIntervals(),
      (config) => config.refresh?.intervals,
    );
    return declared.filter((value) => Number.isFinite(value) && value >= 1000).map(Math.round);
  });

  /**
   * The indicator is drawn whenever auto-refresh is on offer, not only while
   * it runs — but never beside a toolbar that already carries the item. Two
   * places saying the same thing is the mistake the filter builder's bar
   * avoids for the same reason.
   */
  protected readonly showAutoRefresh = computed(
    () =>
      this.ready() &&
      !this.toolbarItemIds().has('autoRefresh') &&
      (this.autoRefresh() || this.resolvedRefreshIntervals().length > 0),
  );

  /**
   * Overlays the grid itself opened. An automatic reload underneath an open
   * header filter would replace the list the user is choosing from.
   *
   * One signal per surface, because the two open and close independently: a
   * single flag has to be recomputed from the other overlay every time one of
   * them closes.
   */
  private readonly headerFilterOpen = signal(false);
  private readonly filterBuilderOpen = signal(false);
  private readonly overlayOpen = computed(
    () => this.headerFilterOpen() || this.filterBuilderOpen(),
  );

  /**
   * Whether a tick would land badly. A refresh is skipped, never queued: the
   * next tick is a whole interval away and carries fresher data anyway.
   */
  protected readonly refreshSuspended = computed(
    () => this.overlayOpen() || this.pendingFilters().size > 0,
  );

  protected readonly autoRefreshLabel = computed(() =>
    this.transloco.translate(this.copy('datagrid.refresh.every'), {
      seconds: Math.round(this.resolvedRefreshInterval() / 1000),
    }),
  );

  private setUpAutoRefresh(): void {
    effect((onCleanup) => {
      const interval = this.resolvedRefreshInterval();
      if (!this.autoRefresh() || this.refreshSuspended()) {
        return;
      }
      const timer = setInterval(() => {
        // A load already running, or a tab nobody is looking at: both make the
        // request pure cost. `document.hidden` is checked here rather than
        // tracked, because a returning tab should wait for its own next tick.
        if (this.loading() || (typeof document !== 'undefined' && document.hidden)) {
          return;
        }
        this.reload();
      }, interval);
      onCleanup(() => {
        clearInterval(timer);
      });
    });
  }

  /** The indicator's on/off control. */
  protected toggleAutoRefresh(): void {
    this.autoRefresh.set(!this.autoRefresh());
  }

  /** The indicator's "refresh now". */
  protected refreshNow(): void {
    this.reload();
  }

  protected onRefreshIntervalMenu(event: MouseEvent): void {
    const menu = this.refreshMenuRef();
    const anchor = event.currentTarget;
    if (menu === undefined || !(anchor instanceof HTMLElement)) {
      return;
    }
    this.refreshMenuItems.set(
      this.resolvedRefreshIntervals().map<MenuItem>((interval) => ({
        label: this.transloco.translate(this.copy('datagrid.refresh.every'), {
          seconds: Math.round(interval / 1000),
        }),
        checked: interval === this.resolvedRefreshInterval(),
        command: () => {
          this.autoRefreshInterval.set(interval);
          this.autoRefresh.set(true);
        },
      })),
    );
    menu.showAt(anchor, undefined, { focusFirstItem: true });
  }

  // --- Export, clipboard and print (§15) ----------------------------------

  private readonly resolvedExport = computed(() =>
    this.fromConfig<ExportConfig | null>('export', null, (config) => config.export),
  );

  /**
   * Whether the grid offers export at all. A withheld capability withholds the
   * affordance rather than drawing it inert (§3.3), and so does
   * `export.enabled: false`.
   */
  protected readonly canExport = computed(
    () => this.allows('exporting') && this.resolvedExport()?.enabled !== false,
  );

  /**
   * Formats offered, in the order the toolbar lists them. `csv` is what the
   * library always writes; `xlsx` resolves once `provideDatagridExcel()` sits
   * in an ancestor injector.
   */
  protected readonly exportFormats = computed<readonly string[]>(() => {
    const declared = this.resolvedExport()?.formats ?? [];
    return declared.length > 0 ? declared : ['csv'];
  });

  /** Runs one export, one clipboard copy or one print, and reports the outcome. */
  private readonly exporter = new ExportController<TRow>({
    config: () => this.resolvedExport(),
    permitted: () => this.permitsCapability('exporting'),
    allowed: () => this.allows('exporting'),
    translate: (key, params) => this.translate(key, params),
    announce: (message) => {
      this.announcement.set(message);
    },
    document: () => this.hostRef.nativeElement.ownerDocument,
    adapters: this.injectedExportAdapters,
    fileSaver: this.injectedFileSaver,
    exportColumns: () =>
      this.columnStore.visibleColumns().filter((column) => column.allow?.exporting !== false),
    widths: () => new Map(this.layout().columns.map((entry) => [entry.id, entry.width])),
    declaredColumns: () => this.declaredColumns(),
    keyOf: () => this.keyGetter(),
    gridLabel: () => this.ariaLabel() || this.translate('datagrid.label'),
    booleanLabels: () => this.resolvedBooleanLabels(),
    timezone: () => this.resolvedTimezone(),
    locale: () => this.resolvedLanguage(),
    cellValue: (row, column) => resolveCellValue(row, column),
    cellText: (row, column) =>
      formatCellText(this.displayFor(row, column, resolveCellValue(row, column)), column, {
        booleanLabels: this.resolvedBooleanLabels(),
        timezone: this.resolvedTimezone(),
        locale: this.resolvedLanguage(),
      }),
    cellDisplay: (row, column) => this.displayFor(row, column, resolveCellValue(row, column)),
    totalSummaries: () => this.totalSummaries(),
    groupSummaries: () => this.groupSummaries(),
    loadedRows: () => this.dataRows(),
    rowFor: (key) => this.rowFor(key),
    selection: () => this.selectionStore.selection(),
    selectedKeys: () => this.selectionStore.selectedKeys(),
    focusedKey: () => this.focusStore.cell()?.key ?? null,
    effectiveQuery: () => this.queryStore.effectiveQuery(),
    fetch: (query, signal) => this.dataStore.fetch(query, signal),
    groupSpecs: () => this.group(),
    fieldValue: () => this.fieldValueGetter(),
    aggregateSpecs: (summaries) => summaryAggregateSpecs(summaries),
    customAggregates: () => this.localCustomAggregates(),
    onProgress: (loaded, total) => {
      this.emitEvent('exportProgress', total == null ? { loaded } : { loaded, total });
    },
    onExported: (format, fileName, rowCount) => {
      this.emitEvent('exported', { format, fileName, rowCount });
    },
    onCanceled: (format) => {
      this.emitEvent('exportCanceled', { format });
    },
    onFailed: (error) => {
      this.emitEvent('exportFailed', { error });
    },
    beforeExport: (model) => {
      const payload = this.emitEvent('beforeExport', {
        format: model.format,
        model,
        fileName: model.fileName,
        canceled: false,
      });
      return payload.canceled ? null : payload.fileName;
    },
  });

  /** Progress of the run in flight, or `null` when nothing is exporting. */
  protected readonly exportState = this.exporter.state;

  /** Runs one export. Resolves when the file is saved, vetoed or canceled. */
  async exportGrid(format: string, options?: ExportOptions): Promise<void> {
    await this.exporter.run(format, options);
  }

  /** Copies the selection, or the focused row, as tab-separated text (§15). */
  async copySelection(options?: ExportOptions): Promise<boolean> {
    return this.exporter.copy(options);
  }

  /** Prints the dataset, rendered from the export model rather than the view. */
  printGrid(): void {
    void this.exporter.print();
  }

  /** Stops the run in flight. Nothing is written and no file is saved. */
  protected cancelExport(): void {
    this.exporter.cancel();
  }

  /** Loads the next page and appends it. Infinite and load-more modes only. */
  loadMore(): void {
    if (this.resolvedPagingMode() === 'none' || !this.page().hasNext || this.loading()) {
      return;
    }
    this.pageIndex.set(this.queryStore.pageIndex() + 1);
  }

  /** Clears the selection. */
  clearSelection(): void {
    this.changeSelection(() => {
      this.selectionStore.clear();
    });
  }

  /** Selects every loaded row, or every matching row per {@link selectAllMode}. */
  selectAll(): void {
    if (this.resolvedSelectionMode() !== 'multiple') {
      return;
    }
    if (this.resolvedSelectAllMode() === 'allMatching') {
      this.selectAllMatching();
      return;
    }
    this.changeSelection(() => {
      this.selectionStore.setPageSelected(this.pageKeys(), true);
    });
  }

  /** Selects every row matching the current query, as a predicate. */
  private selectAllMatching(): void {
    const query = this.queryStore.query();
    this.changeSelection(() => {
      this.selectionStore.selectAllMatching(query.filter ?? null, query.search ?? null);
    });
  }

  /**
   * Runs a selection change behind `selectionChanging`.
   *
   * The event is dispatched synchronously, so a veto is readable the moment
   * the emission returns and the refused change never reaches a render. The
   * anchor travels with the snapshot: it moves on an ordinary click, and a
   * refused click must not move it either.
   */
  private changeSelection(mutate: () => void): void {
    const before = this.selectionStore.selection();
    const anchor = this.selectionStore.anchorState();
    mutate();
    const proposed = this.selectionStore.selection();
    if (structurallyEqual(before, proposed)) {
      return;
    }
    if (this.emitEvent('selectionChanging', { proposed, canceled: false }).canceled) {
      this.selectionStore.restore(before, anchor);
      return;
    }
    this.announceSelection();
  }

  /** Moves focus to a cell, scrolling it into view first. */
  focusCell(position: CellPosition): void {
    const index = this.itemIndexByKey().get(position.key);
    if (index !== undefined) {
      this.revealRow(index);
    }
    this.focusStore.focus(position);
    this.emitEvent('cellFocused', position);
  }

  // --- Grouping and row detail ------------------------------------------

  /** Replaces the grouping. Levels the columns refuse to group by are dropped. */
  private setGroup(specs: readonly GroupSpec[]): void {
    const byField = this.columnsByField();
    const allowed = specs.filter((spec) => {
      const column = byField.get(spec.field);
      return column === undefined || column.allow?.grouping !== false;
    });
    if (structurallyEqual(allowed, this.group())) {
      return;
    }
    this.group.set(allowed);
    this.announceGrouping(allowed);
  }

  /** Adds a level for a column, or removes the one it already has. */
  protected setColumnGrouped(columnId: string, grouped: boolean): void {
    const column = this.columnById(columnId);
    if (column == null || !this.groupable() || !this.permits(columnId, 'grouping')) {
      return;
    }
    const field = columnField(column);
    const current = this.group();
    if (grouped) {
      if (current.some((spec) => spec.field === field)) {
        return;
      }
      this.setGroup([...current, { field }]);
      return;
    }
    this.setGroup(current.filter((spec) => spec.field !== field));
  }

  /** Drops every grouping level. */
  clearGrouping(): void {
    this.setGroup([]);
  }

  protected onGroupDirectionToggled(columnId: string): void {
    const field = this.fieldOfColumnId(columnId);
    this.setGroup(
      this.group().map((spec) =>
        spec.field === field ? { ...spec, desc: spec.desc !== true } : spec,
      ),
    );
  }

  protected onGroupLevelMoved(event: { columnId: string; by: number }): void {
    const field = this.fieldOfColumnId(event.columnId);
    const specs = [...this.group()];
    const from = specs.findIndex((spec) => spec.field === field);
    const to = from + event.by;
    if (from < 0 || to < 0 || to >= specs.length) {
      return;
    }
    const [moved] = specs.splice(from, 1);
    specs.splice(to, 0, moved);
    this.setGroup(specs);
  }

  private fieldOfColumnId(columnId: string): string {
    const column = this.columnById(columnId);
    return column == null ? columnId : columnField(column);
  }

  /** Opens or closes one group. */
  protected toggleGroup(path: readonly unknown[]): void {
    this.groupStore.toggle(path);
    this.announcement.set(
      this.transloco.translate(
        this.copy(
          this.groupStore.isExpanded(path)
            ? 'datagrid.announce.groupExpanded'
            : 'datagrid.announce.groupCollapsed',
        ),
        {
          group: formatGroupValue(
            path[path.length - 1],
            this.group()[path.length - 1]?.field,
            this.columnsByField(),
            this.resolvedBooleanLabels(),
          ),
        },
      ),
    );
  }

  /**
   * Opens or closes one row's detail, behind the cancellable pair of events.
   *
   * Emission is synchronous, so a veto is read the moment the handler returns
   * and the refused change never reaches a render.
   */
  private setRowExpanded(key: GridKey, expanded: boolean): void {
    if (this.detailRenderer() == null) {
      return;
    }
    if (this.expansionStore.isExpanded(key) === expanded) {
      return;
    }
    if (expanded) {
      if (this.emitEvent('rowExpanding', { key, canceled: false }).canceled) {
        return;
      }
      this.expansionStore.expand(key);
      this.emitEvent('rowExpanded', { key });
      return;
    }
    if (this.emitEvent('rowCollapsing', { key, canceled: false }).canceled) {
      return;
    }
    this.expansionStore.collapse(key);
    this.emitEvent('rowCollapsed', { key });
  }

  private toggleRowDetail(key: GridKey): void {
    this.setRowExpanded(key, !this.expansionStore.isExpanded(key));
  }

  protected onScroll(event: Event): void {
    const element = event.target as HTMLElement;
    this.scrollTop.set(element.scrollTop);
    this.scrollLeft.set(element.scrollLeft);
    this.emitEvent('scrolled', { top: element.scrollTop, left: element.scrollLeft });
  }

  protected onViewportFocus(event: FocusEvent): void {
    if (event.target !== this.viewportRef()?.nativeElement) {
      return;
    }
    if (this.focusStore.cell() != null) {
      return;
    }
    this.enterGrid();
  }

  /** Moves focus from the container into the first cell of the visible window. */
  private enterGrid(): void {
    const keys = this.focusKeys();
    const columnIds = this.layout().columns.map((entry) => entry.id);
    if (keys.length === 0 || columnIds.length === 0) {
      return;
    }
    const existing = this.focusStore.cell();
    if (existing != null && this.itemIndexByKey().has(existing.key)) {
      this.focusCell(existing);
      return;
    }
    // The window indexes entries, which is not the same list once group rows
    // are in play; the first focusable entry at or after it is the anchor.
    const start = this.rowWindow().start;
    const items = this.bodyItems();
    const key =
      items == null ? (keys[start] ?? keys[0]) : (this.firstFocusableFrom(items, start) ?? keys[0]);
    this.focusCell({ key, columnId: columnIds[0] });
  }

  private firstFocusableFrom(
    items: readonly GridBodyItem<TRow>[],
    start: number,
  ): GridKey | undefined {
    for (let index = Math.max(0, start); index < items.length; index += 1) {
      const item = items[index];
      if (item.kind === 'data') {
        return item.key;
      }
      if (item.kind === 'group') {
        return groupFocusKey(item.node.path);
      }
    }
    return undefined;
  }

  protected onKeydown(event: KeyboardEvent): void {
    if (this.cardView()) {
      this.onCardKeydown(event);
      return;
    }
    const target = event.target as HTMLElement | null;
    const role = target?.getAttribute('role');
    // Focus parked on the container rather than a cell: any navigation key
    // enters the grid, so the keyboard can never dead-end on the wrapper.
    if (role === 'grid') {
      if (this.directionFor(event) != null || event.key === 'Enter') {
        event.preventDefault();
        this.enterGrid();
      }
      return;
    }
    // Delegation contract: a key typed inside a renderer's own interactive
    // content belongs to that content, not to the grid. Escape is the one
    // exception, and it is the way back out — see `enterCellContent`.
    if (role !== 'gridcell') {
      if (event.key === 'Escape') {
        this.leaveCellContent(target);
      }
      return;
    }
    const cell = this.focusStore.cell();
    // §16.2 gives Right and Left on a group or expandable row to expansion.
    // A group row has one cell and nothing to navigate to; an expander cell
    // only claims the key in the direction that would change something, so
    // the cell walk still works from it.
    if (cell != null && this.handleExpansionKey(cell, event)) {
      event.preventDefault();
      return;
    }
    if (event.key === 'Enter') {
      // The primary cell activates in one press, not two. Its control is the
      // identifier itself, so entering the cell and then pressing what is
      // inside it would put the record further from the keyboard than any
      // other cell — which is the opposite of what §5.1 asks for.
      if (cell != null && this.activatePrimaryCell(cell)) {
        event.preventDefault();
        return;
      }
      // A cell holding a renderer's own controls is entered rather than
      // activated: §16.2 makes the body one tab stop, so those controls are
      // out of the tab order and this is the only way a keyboard reaches
      // them. Escape comes back out. Built-in columns are excluded — their
      // control is the cell, which already answers to Enter.
      if (cell != null && !isBuiltInColumn(cell.columnId) && this.enterCellContent(target)) {
        event.preventDefault();
        return;
      }
      const row = cell == null ? undefined : this.rowFor(cell.key);
      if (cell != null && row !== undefined) {
        event.preventDefault();
        this.activateRow(cell.key, row);
      }
      return;
    }
    if (event.key === ' ' && cell != null && this.resolvedSelectionMode() !== 'none') {
      event.preventDefault();
      this.changeSelection(() => {
        this.selectionStore.toggle(cell.key);
      });
      return;
    }
    if ((event.ctrlKey || event.metaKey) && (event.key === 'a' || event.key === 'A')) {
      if (this.resolvedSelectionMode() === 'multiple') {
        event.preventDefault();
        this.selectAll();
      }
      return;
    }
    if ((event.ctrlKey || event.metaKey) && (event.key === 'c' || event.key === 'C')) {
      if (this.allows('exporting') && this.exporter.canCopy()) {
        event.preventDefault();
        void this.copySelection();
      }
      return;
    }
    const direction = this.directionFor(event);
    if (direction == null) {
      return;
    }
    event.preventDefault();
    const next = moveFocus(cell, direction, {
      keys: this.focusKeys(),
      columnIds: this.layout().columns.map((entry) => entry.id),
      pageStep: pageStep(this.viewportHeight(), this.resolvedRowHeight()),
    });
    if (next == null) {
      return;
    }
    // Shift with a vertical arrow extends the selection over the rows it
    // walks, matching how a list behaves. The range starts at the row the
    // focus is leaving, so the very first Shift+Arrow takes both rows rather
    // than only the one it lands on.
    if (event.shiftKey && this.resolvedSelectionMode() === 'multiple' && next.key !== cell?.key) {
      const from = cell?.key;
      this.changeSelection(() => {
        if (from !== undefined) {
          this.selectionStore.anchorIfUnset(from);
        }
        this.selectionStore.selectRange(next.key, this.rowKeys());
      });
    }
    this.focusCell(next);
  }

  /**
   * The card list's keyboard model.
   *
   * A list, not a grid: focus is per card, the vertical arrows walk the cards
   * and the horizontal ones belong to expansion. `Enter` activates, `Space`
   * selects, and a card's own controls are entered exactly as a cell's are —
   * the body is one tab stop in both presentations.
   */
  private onCardKeydown(event: KeyboardEvent): void {
    const target = event.target as HTMLElement | null;
    const inCard = target?.closest(CARD_SELECTOR) ?? target?.closest('.dg-card-group');
    // A key typed inside a renderer's own controls belongs to that content.
    // Escape is the way back out, as it is from a cell.
    if (inCard != null && inCard !== target) {
      if (event.key === 'Escape') {
        (inCard as HTMLElement).focus();
      }
      return;
    }
    const cell = this.focusStore.cell();
    if (inCard == null) {
      // Focus parked on the scroll container: any navigation key enters the
      // list, so the keyboard can never dead-end on the wrapper.
      if (this.directionFor(event) != null || event.key === 'Enter') {
        event.preventDefault();
        this.enterCards();
      }
      return;
    }
    if (cell != null && this.handleCardExpansionKey(cell, event)) {
      event.preventDefault();
      return;
    }
    // A card is the whole row, so `Enter` is the row's activation and never an
    // "enter the cell" step: a card holding actions would otherwise have no
    // key left to activate the record with. `F2` enters its controls instead,
    // and `Escape` comes back out — the ARIA grid pattern's other way in.
    if (event.key === 'Enter' && cell != null) {
      const row = this.rowFor(cell.key);
      if (row === undefined) {
        return;
      }
      event.preventDefault();
      this.activateCard(cell.key, row);
      return;
    }
    if (event.key === 'F2' && inCard instanceof HTMLElement) {
      if (this.enterCellContent(inCard)) {
        event.preventDefault();
      }
      return;
    }
    if (event.key === ' ' && cell != null && this.resolvedSelectionMode() !== 'none') {
      event.preventDefault();
      this.changeSelection(() => {
        this.selectionStore.toggle(cell.key);
      });
      return;
    }
    if ((event.ctrlKey || event.metaKey) && (event.key === 'a' || event.key === 'A')) {
      if (this.resolvedSelectionMode() === 'multiple') {
        event.preventDefault();
        this.selectAll();
      }
      return;
    }
    const direction = this.directionFor(event);
    if (direction == null) {
      return;
    }
    event.preventDefault();
    const next = moveFocus(cell, direction, {
      keys: this.focusKeys(),
      columnIds: [CARD_FOCUS_COLUMN],
      pageStep: CARD_PAGE_STEP,
    });
    if (next == null) {
      return;
    }
    if (event.shiftKey && this.resolvedSelectionMode() === 'multiple' && next.key !== cell?.key) {
      const from = cell?.key;
      this.changeSelection(() => {
        if (from !== undefined) {
          this.selectionStore.anchorIfUnset(from);
        }
        this.selectionStore.selectRange(next.key, this.rowKeys());
      });
    }
    this.focusStore.focus(next);
  }

  /** Moves focus from the scroll container into the first card. */
  private enterCards(): void {
    const existing = this.focusStore.cell();
    const items = this.cardItems();
    if (existing != null && items.some((item) => item.key === existing.key)) {
      this.focusStore.focus({ key: existing.key, columnId: CARD_FOCUS_COLUMN });
      return;
    }
    const first = items.find((item) => item.kind !== 'cardDetail');
    if (first != null) {
      this.focusStore.focus({ key: first.key, columnId: CARD_FOCUS_COLUMN });
    }
  }

  /**
   * Expansion keys on a card: both horizontal arrows, since a card has no
   * second cell for them to walk to. A group heading answers the same way.
   */
  private handleCardExpansionKey(cell: CellPosition, event: KeyboardEvent): boolean {
    if (event.ctrlKey || event.metaKey || event.altKey || event.shiftKey) {
      return false;
    }
    const horizontal = event.key === 'ArrowRight' || event.key === 'ArrowLeft';
    const group = this.groupPathFor(cell.key);
    if (group != null) {
      const expanded = this.groupStore.isExpanded(group);
      if (event.key === 'Enter' || event.key === ' ') {
        this.toggleGroup(group);
        return true;
      }
      if ((event.key === 'ArrowRight' && !expanded) || (event.key === 'ArrowLeft' && expanded)) {
        this.toggleGroup(group);
        return true;
      }
      return horizontal;
    }
    if (!horizontal || this.detailRenderer() == null) {
      return false;
    }
    const expanded = this.expansionStore.isExpanded(cell.key);
    if ((event.key === 'ArrowRight' && !expanded) || (event.key === 'ArrowLeft' && expanded)) {
      this.toggleRowDetail(cell.key);
    }
    // Claimed either way: there is no cell to the side of a card, so an arrow
    // that fell through would do nothing at all.
    return true;
  }

  /**
   * Resolves an expansion key press, returning whether it was consumed.
   *
   * A group row answers to `Enter`, `Space` and both horizontal arrows. An
   * expander cell answers to `Enter` and `Space`, and to the arrow that would
   * actually change its state — so `Right` on an open row still walks to the
   * next cell rather than doing nothing.
   */
  private handleExpansionKey(cell: CellPosition, event: KeyboardEvent): boolean {
    if (event.ctrlKey || event.metaKey || event.altKey || event.shiftKey) {
      return false;
    }
    const group = this.groupPathFor(cell.key);
    if (group != null) {
      const expanded = this.groupStore.isExpanded(group);
      if (event.key === 'Enter' || event.key === ' ') {
        this.toggleGroup(group);
        return true;
      }
      if (event.key === 'ArrowRight' && !expanded) {
        this.toggleGroup(group);
        return true;
      }
      if (event.key === 'ArrowLeft' && expanded) {
        this.toggleGroup(group);
        return true;
      }
      // A bare arrow on a group row has no cell to move to sideways, so it
      // is swallowed rather than left to walk a row of one.
      return event.key === 'ArrowRight' || event.key === 'ArrowLeft';
    }
    if (cell.columnId !== DETAIL_COLUMN_ID || this.detailRenderer() == null) {
      return false;
    }
    const expanded = this.expansionStore.isExpanded(cell.key);
    if (event.key === 'Enter' || event.key === ' ') {
      this.toggleRowDetail(cell.key);
      return true;
    }
    if ((event.key === 'ArrowRight' && !expanded) || (event.key === 'ArrowLeft' && expanded)) {
      this.toggleRowDetail(cell.key);
      return true;
    }
    return false;
  }

  /**
   * Moves focus into the first control a renderer put inside the cell.
   *
   * The ARIA grid pattern's answer for a cell that holds widgets: arrow keys
   * walk cells, and the cell is entered to reach what is inside it. Returns
   * whether there was anything to enter, so a plain cell still activates its
   * row.
   */
  private enterCellContent(cellElement: HTMLElement | null): boolean {
    const widget = cellElement?.querySelector<HTMLElement>(CELL_WIDGET_SELECTOR);
    if (widget == null) {
      return false;
    }
    widget.focus();
    return true;
  }

  /**
   * Emits `primaryCellActivated` for a focused primary cell (§5.1). Returns
   * whether it did, so an ordinary cell still falls through to the rest of
   * what `Enter` does.
   */
  private activatePrimaryCell(position: CellPosition): boolean {
    const column = this.columnById(position.columnId);
    const row = this.rowFor(position.key);
    if (column == null || row === undefined || primarySpecOf(column) == null) {
      return false;
    }
    this.emitEvent('primaryCellActivated', { key: position.key, row });
    return true;
  }

  /** Escape inside a cell's own controls returns focus to the cell. */
  private leaveCellContent(target: HTMLElement | null): void {
    const cellElement = target?.closest<HTMLElement>('[role="gridcell"]');
    if (cellElement != null) {
      cellElement.focus();
    }
  }

  /**
   * Focuses a card, scrolling it into view.
   *
   * `scrollIntoView` rather than the offset arithmetic the table uses: the
   * card list is not virtualized, so the element is always in the DOM and the
   * browser knows where it is better than a prefix sum would.
   */
  private applyCardFocus(host: HTMLElement, cell: CellPosition): void {
    const keyText = serializeKey(cell.key);
    // Matched by reading attributes rather than by a selector: a key may hold
    // any character, and `CSS.escape` is not available everywhere.
    for (const element of host.querySelectorAll<HTMLElement>('[data-card], .dg-card-group')) {
      if (element.getAttribute('data-key') === keyText) {
        // Absent in jsdom, where the DOM types promise it. Focusing still
        // works, and there is nothing to scroll in a layout-free environment.
        try {
          element.scrollIntoView({ block: 'nearest' });
        } catch {
          // The element is focused either way.
        }
        element.focus();
        return;
      }
    }
  }

  /** The group path a focus key names, or `null` when the key is a data row. */
  private groupPathFor(key: GridKey): readonly unknown[] | null {
    const index = this.itemIndexByKey().get(key);
    const item = index === undefined ? undefined : this.bodyItems()?.[index];
    return item?.kind === 'group' ? item.node.path : null;
  }

  protected onViewportClick(event: MouseEvent): void {
    if (this.cardView()) {
      this.onCardClick(event);
      return;
    }
    const position = this.cellFromEvent(event);
    if (position == null) {
      return;
    }
    const group = this.groupPathFor(position.key);
    if (group != null) {
      this.toggleGroup(group);
      return;
    }
    const row = this.rowFor(position.key);
    if (row === undefined) {
      return;
    }
    if (position.columnId === DETAIL_COLUMN_ID && this.detailRenderer() != null) {
      this.toggleRowDetail(position.key);
      return;
    }
    // The press is read here rather than stopped in the renderer: the grid
    // owns the event, and the cell has no way to reach it. Opening a record is
    // not selecting its row, so the selection click is what gives way.
    const primary = (event.target as HTMLElement | null)?.closest(PRIMARY_ACTIVATE_SELECTOR);
    if (primary == null) {
      this.applySelectionClick(position.columnId, position.key, event);
    }
    this.emitEvent('cellClick', { key: position.key, columnId: position.columnId, row, event });
    this.emitEvent('rowClick', { key: position.key, row, event });
    if (primary != null) {
      this.emitEvent('primaryCellActivated', { key: position.key, row });
    }
  }

  /**
   * Resolves a click into a selection change. The checkbox column always
   * selects; a data cell only does when {@link selectOnRowClick} is on, so a
   * checkbox-driven grid can keep clicks for activation.
   */
  private applySelectionClick(columnId: string, key: GridKey, event: MouseEvent): void {
    const mode = this.resolvedSelectionMode();
    if (mode === 'none') {
      return;
    }
    const viaCheckbox = columnId === SELECTION_COLUMN_ID;
    if (!viaCheckbox && !this.selectOnRowClick()) {
      return;
    }
    this.changeSelection(() => {
      if (event.shiftKey && mode === 'multiple') {
        this.selectionStore.selectRange(key, this.rowKeys());
      } else if (viaCheckbox || event.ctrlKey || event.metaKey) {
        this.selectionStore.toggle(key);
      } else {
        this.selectionStore.select(key);
      }
    });
  }

  protected onViewportDoubleClick(event: MouseEvent): void {
    // A card activates on the first press, so a second one has nothing left to
    // report. `rowDoubleClick` still reaches the host from the card branch.
    if (this.cardView()) {
      return;
    }
    const position = this.cellFromEvent(event);
    const row = position == null ? undefined : this.rowFor(position.key);
    if (position == null || row === undefined) {
      return;
    }
    this.emitEvent('cellDoubleClick', {
      key: position.key,
      columnId: position.columnId,
      row,
      event,
    });
    this.emitEvent('rowDoubleClick', { key: position.key, row, event });
    // The first of the two clicks already opened the record. Activating the
    // row as well would report the same intent under a second name.
    if ((event.target as HTMLElement | null)?.closest(PRIMARY_ACTIVATE_SELECTOR) == null) {
      this.activateRow(position.key, row);
    }
  }

  /**
   * Activation is separate from selection. In single mode it may also clear
   * the selection, which is what `toggleOnReactivate` asks for.
   */
  private activateRow(key: GridKey, row: TRow): void {
    if (
      this.resolvedToggleOnReactivate() &&
      this.resolvedSelectionMode() === 'single' &&
      this.selectionStore.isSelected(key)
    ) {
      this.changeSelection(() => {
        this.selectionStore.clear();
      });
    }
    this.emitEvent('rowActivated', { key, row });
  }

  /** A pointer press moves the roving tabindex, matching what the user clicked. */
  protected onViewportMousedown(event: MouseEvent): void {
    const position = this.cardView()
      ? this.cardPositionFromEvent(event)
      : this.cellFromEvent(event);
    if (position != null) {
      this.focusStore.focus(position);
      this.emitEvent('cellFocused', position);
    }
  }

  /**
   * A press on a card.
   *
   * The three presses of the table, on the shapes a card has: the checkbox
   * selects, the title activates the record, and the card itself is the row
   * click. The one deliberate difference is that a card **activates on the
   * first press** — the table waits for a double click, which is not a gesture
   * a touch screen has, and the card is the large target a phone offers.
   */
  private onCardClick(event: MouseEvent): void {
    const target = event.target as HTMLElement | null;
    const position = this.cardPositionFromEvent(event);
    if (position == null) {
      return;
    }
    const group = this.groupPathFor(position.key);
    if (group != null) {
      this.toggleGroup(group);
      return;
    }
    const row = this.rowFor(position.key);
    if (row === undefined) {
      return;
    }
    if (target?.closest(CARD_EXPAND_SELECTOR) != null) {
      this.toggleRowDetail(position.key);
      return;
    }
    const primary = target?.closest(PRIMARY_ACTIVATE_SELECTOR);
    const viaCheckbox = target?.closest(CARD_SELECT_SELECTOR) != null;
    if (primary == null) {
      this.applyCardSelectionClick(position.key, event, viaCheckbox);
    }
    this.emitEvent('rowClick', { key: position.key, row, event });
    if (primary != null) {
      // Opening a record is not selecting it, and it is not activating the row
      // either — §5.1 gives the identifier its own event and nothing else.
      this.emitEvent('primaryCellActivated', { key: position.key, row });
      return;
    }
    if (!viaCheckbox) {
      this.activateCard(position.key, row);
    }
  }

  /**
   * A press or `Enter` on a card. The card is the record's whole target, so
   * with a primary column it opens the record as the title does. Without one
   * it activates the row.
   */
  private activateCard(key: GridKey, row: TRow): void {
    if (this.hasPrimaryColumn()) {
      this.emitEvent('primaryCellActivated', { key, row });
    } else {
      this.activateRow(key, row);
    }
  }

  /** The card's half of {@link applySelectionClick}, which has no columns. */
  private applyCardSelectionClick(key: GridKey, event: MouseEvent, viaCheckbox: boolean): void {
    const mode = this.resolvedSelectionMode();
    if (mode === 'none' || (!viaCheckbox && !this.selectOnRowClick())) {
      return;
    }
    this.changeSelection(() => {
      if (event.shiftKey && mode === 'multiple') {
        this.selectionStore.selectRange(key, this.rowKeys());
      } else if (viaCheckbox || event.ctrlKey || event.metaKey) {
        this.selectionStore.toggle(key);
      } else {
        this.selectionStore.select(key);
      }
    });
  }

  /**
   * The card a pointer event landed in, as a focus position.
   *
   * A card has no columns, so the position names {@link CARD_FOCUS_COLUMN} —
   * the two presentations share one focus store, and a card that reported a
   * real column id would move the table's cell focus sideways behind the
   * user's back.
   */
  private cardPositionFromEvent(event: Event): CellPosition | null {
    const target = event.target as HTMLElement | null;
    const element = target?.closest(`${CARD_SELECTOR}, .dg-card-group`);
    const keyText = element?.getAttribute('data-key');
    if (keyText == null) {
      return null;
    }
    // The rendered key is serialized text; the real key comes from the view
    // model so numeric and bigint keys keep their type.
    const rendered = this.cardItems().find((candidate) => candidate.keyText === keyText);
    return rendered == null ? null : { key: rendered.key, columnId: CARD_FOCUS_COLUMN };
  }

  /**
   * Resolves the cell a pointer event landed in. Pointer handling is delegated
   * to the viewport: a listener per cell would mean hundreds of listeners
   * churning with every scroll step.
   */
  private cellFromEvent(event: Event): CellPosition | null {
    const target = event.target as HTMLElement | null;
    const cellElement = target?.closest('[role="gridcell"]');
    const columnId = cellElement?.getAttribute('data-column');
    const keyText = cellElement?.closest('[role="row"]')?.getAttribute('data-key');
    if (columnId == null || keyText == null) {
      return null;
    }
    // The rendered key is serialized text; the real key comes from the view
    // model so numeric and bigint keys keep their type.
    const rendered = this.renderItems().find((candidate) => candidate.keyText === keyText);
    return rendered == null ? null : { key: rendered.key, columnId };
  }

  // --- Header interaction ----------------------------------------------

  protected onSortToggled(event: {
    columnId: string;
    multi: boolean;
    direction?: 'asc' | 'desc' | null;
  }): void {
    const column = this.columnById(event.columnId);
    if (column == null || !this.sortable() || !this.permits(event.columnId, 'sorting')) {
      return;
    }
    const field = sortFieldOf(column);
    const next = toggleSort(this.sort(), field, {
      multi: event.multi && this.multiSort(),
      cycle: this.sortCycle(),
      ...(event.direction === undefined ? {} : { force: event.direction }),
    });
    this.sort.set(next);
    const caption = column.caption ?? column.field ?? column.id;
    const direction = sortDirectionOf(next, field);
    this.announcement.set(
      direction == null
        ? this.transloco.translate(this.copy('datagrid.announce.sortCleared'), { column: caption })
        : this.transloco.translate(
            this.copy(
              direction === 'asc' ? 'datagrid.announce.sortedAsc' : 'datagrid.announce.sortedDesc',
            ),
            { column: caption },
          ),
    );
  }

  protected onColumnResized(event: { columnId: string; delta: number; live: boolean }): void {
    const layout = this.layout();
    const fit = this.fitColumns();
    if (fit) {
      this.freezeFittedWidths(layout);
    }
    const changes = resizeColumn(layout, event.columnId, event.delta, {
      minWidth: Math.max(1, this.minColumnWidth()),
      // `fitColumns` holds the total at the container width. Widening would
      // break that on every frame and hand the difference back through the fit
      // pass, so under fit the neighbour absorbs the drag.
      mode: fit ? 'adjacent' : this.resizeMode(),
    });
    for (const change of changes) {
      this.applyColumnWidth(change.id, change.width, { settled: !event.live });
    }
  }

  /**
   * Writes the widths the fit pass produced back as the declared ones.
   *
   * Under `fitColumns` a rendered width carries a share of the container
   * surplus. Writing one of them back on its own leaves the rest of the
   * surplus to spread over every column again, the dragged one included, so
   * the column grows on the frame the drag asked it to shrink. Once the
   * surplus is spent the fit pass has nothing left to hand out and the delta
   * is the only thing that moves.
   *
   * Nothing on screen changes, so this reports no width: the drag reports the
   * column the user actually resized when it lets go.
   */
  private freezeFittedWidths(layout: GridLayout<TRow>): void {
    for (const entry of layout.columns) {
      if (isBuiltInColumn(entry.id) || entry.column.width === entry.width) {
        continue;
      }
      this.columnStore.setWidth(entry.id, entry.width);
    }
  }

  /** A drag reports the width the user settled on, not the frames it passed. */
  protected onResizeEnded(): void {
    for (const [columnId, width] of this.pendingResize) {
      this.emitEvent('columnResized', { columnId, width });
    }
    this.pendingResize.clear();
  }

  /** A drag swaps as it passes, so this lands the unit and holds the report. */
  protected onColumnReordered(event: {
    columnId: string;
    overId: string;
    kind: HeaderUnitKind;
  }): void {
    if (event.kind === 'band') {
      this.applyUnitMove(event.columnId, event.overId, { settled: false });
      return;
    }
    const target = reorderTarget(this.layout(), event.columnId, event.overId);
    if (target != null) {
      this.applyColumnMove(event.columnId, this.toHostIndex(target), { settled: false });
    }
  }

  /** A reorder drag passed its threshold: take over drawing its ghost. */
  protected onHeaderDragStarted(event: {
    columnId: string;
    kind: HeaderUnitKind;
    caption: string;
    width: number;
    grabX: number;
    grabY: number;
  }): void {
    // A band is not a grouping level, so a band drag must never offer the
    // group panel as a destination.
    this.dragColumnId = event.kind === 'band' ? null : event.columnId;
    this.dragGrab = { x: event.grabX, y: event.grabY };
    this.dragGhost.set({ caption: event.caption, width: event.width, left: 0, top: 0 });
  }

  /**
   * Moves the ghost and tracks the drag against the group panel.
   *
   * The header owns the pointer capture but not the panel's whereabouts, so
   * the hit test lives here. While the pointer is inside the panel the header
   * stands down and stops swapping columns underneath it.
   */
  protected onHeaderDragMoved(event: { columnId: string; clientX: number; clientY: number }): void {
    this.dragColumnId = event.columnId;
    const host = this.hostRef.nativeElement.getBoundingClientRect();
    this.dragGhost.update((ghost) =>
      ghost == null
        ? null
        : {
            ...ghost,
            left: event.clientX - host.left - this.dragGrab.x,
            top: event.clientY - host.top - this.dragGrab.y,
          },
    );
    const panel = this.groupPanelRef()?.nativeElement;
    if (panel == null || !this.canGroupColumn(event.columnId)) {
      if (this.groupDropActive()) {
        this.groupDropActive.set(false);
      }
      return;
    }
    const bounds = panel.getBoundingClientRect();
    const inside =
      event.clientX >= bounds.left &&
      event.clientX <= bounds.right &&
      event.clientY >= bounds.top &&
      event.clientY <= bounds.bottom;
    if (this.groupDropActive() !== inside) {
      this.groupDropActive.set(inside);
    }
  }

  private canGroupColumn(columnId: string): boolean {
    const column = this.columnById(columnId);
    return (
      this.groupable() &&
      this.allows('grouping') &&
      column != null &&
      column.allow?.grouping !== false
    );
  }

  /** A drag reports the position the column landed on, not the ones it passed. */
  protected onReorderEnded(): void {
    const move = this.pendingMove;
    const columnId = this.dragColumnId;
    this.pendingMove = null;
    this.dragColumnId = null;
    this.dragGhost.set(null);
    if (this.groupDropActive()) {
      this.groupDropActive.set(false);
      if (columnId != null) {
        this.setColumnGrouped(columnId, true);
        return;
      }
    }
    if (move == null) {
      return;
    }
    this.emitEvent('columnMoved', move);
    this.announceColumnMoved(move.columnId, move.visibleIndex);
  }

  /** A keyboard reorder names the sibling it moves past, band or column. */
  protected onColumnMoved(event: { columnId: string; overId: string }): void {
    this.applyUnitMove(event.columnId, event.overId, { settled: true });
  }

  /**
   * Moves a header unit past a sibling. A band carries every column under it,
   * so the store is handed the two ids rather than a position: a band has no
   * single position, and stepping its columns over one at a time would walk
   * them through the band they are passing.
   */
  private applyUnitMove(unitId: string, overId: string, options: { settled: boolean }): void {
    if (!this.permitsCapability('reordering')) {
      return;
    }
    const isBandMove = this.bandIndex().bands.has(unitId);
    if (!isBandMove && !this.permits(unitId, 'reordering')) {
      return;
    }
    const visibleIndex = this.columnStore.moveUnit(unitId, overId);
    if (visibleIndex == null) {
      return;
    }
    const move = { columnId: unitId, visibleIndex };
    if (options.settled) {
      this.pendingMove = null;
      this.emitEvent('columnMoved', move);
      this.announceColumnMoved(unitId, visibleIndex);
    } else {
      this.pendingMove = move;
    }
  }

  private announceColumnMoved(columnId: string, hostIndex: number): void {
    const band = this.bandIndex().bands.get(columnId);
    this.announcement.set(
      this.transloco.translate(this.copy('datagrid.announce.columnMoved'), {
        column: band?.caption ?? this.columnById(columnId)?.caption ?? columnId,
        position: hostIndex + 1,
      }),
    );
  }

  protected onColumnPinned(event: { columnId: string; side: 'start' | 'end' | false }): void {
    this.applyColumnPin(event.columnId, event.side);
  }

  protected onColumnHidden(event: { columnId: string }): void {
    const column = this.columnById(event.columnId);
    if (column?.allow?.hiding === false) {
      return;
    }
    this.applyColumnVisible(event.columnId, false);
    this.announcement.set(
      this.transloco.translate(this.copy('datagrid.announce.columnHidden'), {
        column: column?.caption ?? event.columnId,
      }),
    );
  }

  /** The column menu's row-number toggle. Showing a column is the `hiding` capability. */
  protected onRowNumbersToggled(visible: boolean): void {
    if (this.permitsCapability('hiding')) {
      this.showRowNumbers.set(visible);
    }
  }

  protected onSelectAllToggled(selected: boolean): void {
    if (selected) {
      this.selectAll();
    } else {
      this.clearSelection();
    }
  }

  // --- Filtering ---------------------------------------------------------

  /**
   * Records what the user typed and queues it.
   *
   * The editor state is written now, so the bound value never lags the DOM and
   * the caret stays where it is; only the query waits.
   */
  protected onFilterChanged(change: DatagridFilterChange): void {
    const column = this.columnById(change.columnId);
    if (column == null) {
      return;
    }
    this.filterEditors.update((editors) =>
      new Map(editors).set(change.columnId, {
        op: change.op,
        value: change.value,
        valueEnd: change.valueEnd,
      }),
    );
    // An explicit edit ends the relative period on this column: §7.4 makes the
    // most recent explicit action the winner, so the two never oscillate.
    this.queryStore.setRelativeDateFilter(change.columnId, null);
    this.markFilterPending(change.columnId);
    if (this.filterRowFeature()?.apply === 'deferred') {
      return;
    }
    this.restartFilterTimer();
  }

  /** Sends every waiting editor at once. The deferred-apply button's action. */
  protected applyPendingFilters(): void {
    this.flushFilters();
  }

  protected onFilterCommitted(event: { columnId: string }): void {
    this.markFilterPending(event.columnId);
    this.flushFilters();
  }

  /** Records that a column's editor holds an edit the query has not seen. */
  private markFilterPending(columnId: string): void {
    this.pendingFilters.update((pending) =>
      pending.has(columnId) ? pending : new Set(pending).add(columnId),
    );
  }

  private restartFilterTimer(): void {
    if (this.filterTimer != null) {
      clearTimeout(this.filterTimer);
    }
    this.filterTimer = setTimeout(() => {
      this.flushFilters();
    }, FILTER_APPLY_DELAY);
  }

  /** Writes every queued editor to the query store, which coalesces them. */
  private flushFilters(): void {
    if (this.filterTimer != null) {
      clearTimeout(this.filterTimer);
      this.filterTimer = null;
    }
    const columnIds = [...this.pendingFilters()];
    this.pendingFilters.set(new Set());
    for (const columnId of columnIds) {
      const column = this.columnById(columnId);
      const state = this.filterEditors().get(columnId);
      if (column == null || state === undefined) {
        continue;
      }
      this.setColumnFilterNode(column, this.editorNode(column, state));
    }
    const last = columnIds.at(-1);
    if (last != null) {
      this.announceFilter(last);
    }
  }

  /**
   * Applies a relative period, which supersedes whatever the editor held —
   * the same last-action-wins rule, from the other direction.
   */
  protected onRelativeSelected(event: {
    columnId: string;
    preset: RelativeDateFilter | null;
  }): void {
    const column = this.columnById(event.columnId);
    if (column == null) {
      return;
    }
    if (event.preset == null) {
      this.queryStore.setRelativeDateFilter(event.columnId, null);
      this.announceFilterCleared(event.columnId);
      return;
    }
    this.clearColumnEditor(event.columnId);
    this.queryStore.setColumnFilter(event.columnId, null);
    this.queryStore.setRelativeDateFilter(event.columnId, {
      field: columnField(column),
      filter: event.preset,
    });
    this.takeTreeFilter(columnField(column));
    this.announceFilter(event.columnId);
  }

  /**
   * Writes one column's filter and takes its field back from the free tree.
   *
   * With synchronization on, a representable condition the tree holds shows in
   * that column's filter row cell. Editing the cell makes the column the owner
   * of the field, and leaving the tree condition behind would filter the field
   * twice — once by what the user just typed and once by what they replaced.
   */
  private setColumnFilterNode(column: ColumnDef<TRow>, node: FilterNode | null): void {
    this.queryStore.setColumnFilter(column.id, node);
    if (node != null) {
      this.takeTreeFilter(columnField(column));
    }
  }

  /** Drops every top-level condition on a field from the free filter tree. */
  private takeTreeFilter(field: string): void {
    if (!this.resolvedFilterSync()) {
      return;
    }
    const nodes = flattenAnd(this.queryStore.filter());
    const remaining = nodes.filter((node) => !(isConditionNode(node) && node.field === field));
    if (remaining.length !== nodes.length) {
      this.filter.set(and(...remaining));
    }
  }

  /** Drops every filter on one column: both slots and the relative period. */
  clearColumnFilter(columnId: string): void {
    this.clearColumnEditor(columnId);
    this.queryStore.setColumnFilter(columnId, null);
    this.queryStore.setHeaderFilter(columnId, null);
    this.queryStore.setRelativeDateFilter(columnId, null);
    this.announceFilterCleared(columnId);
  }

  private clearColumnEditor(columnId: string): void {
    this.pendingFilters.update((pending) => {
      if (!pending.has(columnId)) {
        return pending;
      }
      const next = new Set(pending);
      next.delete(columnId);
      return next;
    });
    this.filterEditors.update((editors) => {
      if (!editors.has(columnId)) {
        return editors;
      }
      const next = new Map(editors);
      next.delete(columnId);
      return next;
    });
  }

  /** Drops every user filter: column filters, relative periods, tree, search. */
  clearAllFilters(): void {
    this.pendingFilters.set(new Set());
    this.filterEditors.set(new Map());
    this.queryStore.clearFilters();
    this.announcement.set(this.transloco.translate(this.copy('datagrid.announce.filtersCleared')));
  }

  /** Removes one entry of the filter panel, at the facet that holds it. */
  protected onFilterChipRemoved(event: { id: string }): void {
    const separator = event.id.indexOf(':');
    const source = separator < 0 ? event.id : event.id.slice(0, separator);
    const rest = separator < 0 ? '' : event.id.slice(separator + 1);
    switch (source) {
      case 'column':
      case 'relative':
        // Both live in the slot the filter row owns, and clearing one of them
        // must not take the header filter's selection with it.
        this.clearColumnEditor(rest);
        this.queryStore.setColumnFilter(rest, null);
        this.queryStore.setRelativeDateFilter(rest, null);
        this.announceFilterCleared(rest);
        return;
      case 'header':
        this.queryStore.setHeaderFilter(rest, null);
        this.announceFilterCleared(rest);
        return;
      case 'tree': {
        const index = Number(rest);
        const remaining = flattenAnd(this.queryStore.filter()).filter(
          (_node, position) => position !== index,
        );
        this.filter.set(and(...remaining));
        return;
      }
      case 'search':
        this.search.set(null);
        return;
    }
  }

  private announceFilter(columnId: string): void {
    this.announcement.set(
      this.transloco.translate(this.copy('datagrid.announce.filtered'), {
        column: this.columnById(columnId)?.caption ?? columnId,
      }),
    );
  }

  private announceFilterCleared(columnId: string): void {
    this.announcement.set(
      this.transloco.translate(this.copy('datagrid.announce.filterCleared'), {
        column: this.columnById(columnId)?.caption ?? columnId,
      }),
    );
  }

  // --- Header filter -----------------------------------------------------

  protected onHeaderFilterRequested(event: { columnId: string; anchor: HTMLElement }): void {
    this.headerFilter.open(event);
  }

  // --- Shared column mutations ------------------------------------------
  //
  // The header, the column chooser and the API all go through these, so a
  // change reports once and reports the same way whichever path produced it.

  /**
   * Whether a column permits an operation, complaining in development when it
   * does not.
   *
   * `ColumnDef.allow` is the column's public refusal and the capability mask is
   * the grid's; the two combine by conjunction, as §3.3 requires. The
   * imperative API passes through the same gate the pointer and menu flows do —
   * otherwise `allow.resizing: false` and a read-only mask would hold only for
   * the users, not for the code. The grid's own columns declare every operation
   * off, and they are checked by id because they are not in the host's column
   * list.
   *
   * The grid-level `allowColumnResize` and `allowColumnReorder` are not
   * consulted: those switch off an affordance, and a host that took the drag
   * handle away may still set a width itself.
   */
  private permits(id: string, permission: keyof ColumnAllow): boolean {
    if (!this.allows(CAPABILITY_OF_ALLOW[permission])) {
      if (isDevMode()) {
        console.warn(`datagrid: ${permission} is withheld by the capability mask.`);
      }
      return false;
    }
    const allowed = isBuiltInColumn(id)
      ? false
      : this.columnById(id)?.allow?.[permission] !== false;
    if (!allowed && isDevMode()) {
      console.warn(`datagrid: column "${id}" does not allow ${permission}.`);
    }
    return allowed;
  }

  /**
   * Whether a grid-level action may run, complaining in development when it
   * may not. The column-scoped twin is {@link permits}.
   */
  private permitsCapability(capability: keyof GridCapabilityMask): boolean {
    if (this.allows(capability)) {
      return true;
    }
    if (isDevMode()) {
      console.warn(`datagrid: ${capability} is withheld by the capability mask.`);
    }
    return false;
  }

  /**
   * A drag frame is an intermediate width, not one the user chose, so it is
   * held until the drag lets go — §20 forbids a burst from one action.
   */
  private applyColumnWidth(
    id: string,
    width: number | 'auto',
    options: { settled: boolean } = { settled: true },
  ): void {
    if (!this.permits(id, 'resizing')) {
      return;
    }
    this.columnStore.setWidth(id, width);
    if (options.settled) {
      this.pendingResize.delete(id);
      this.emitEvent('columnResized', { columnId: id, width });
    } else {
      this.pendingResize.set(id, width);
    }
  }

  /**
   * Sizes every resizable column to its widest rendered content (§5.1).
   *
   * Only the rendered window is measured, and that is the honest limit of the
   * feature rather than an omission: virtualization is what keeps the work
   * proportional to the visible cells, and a column sized against ten thousand
   * unrendered rows would have to render them first. `scrollWidth` reports the
   * content width even where the cell clips it, so a truncated cell measures
   * the text it is hiding.
   */
  autoSizeColumns(): void {
    const viewport = this.viewportRef()?.nativeElement;
    if (viewport == null) {
      return;
    }
    const widest = new Map<string, number>();
    for (const cell of viewport.querySelectorAll<HTMLElement>('[data-column]')) {
      const id = cell.dataset['column'];
      if (id == null || isBuiltInColumn(id)) {
        continue;
      }
      widest.set(id, Math.max(widest.get(id) ?? 0, cell.scrollWidth));
    }
    const floor = Math.max(1, this.minColumnWidth());
    for (const [id, content] of widest) {
      if (content <= 0) {
        continue;
      }
      const column = this.columnById(id);
      const width = Math.max(
        column?.minWidth ?? floor,
        Math.min(
          column?.maxWidth ?? Number.POSITIVE_INFINITY,
          Math.ceil(content) + AUTO_SIZE_SLACK,
        ),
      );
      this.applyColumnWidth(id, width);
    }
  }

  /**
   * A drag swaps the column every time it passes another one, so the
   * intermediate positions are held until it lets go — §20 forbids a burst
   * from one action.
   */
  private applyColumnMove(
    id: string,
    visibleIndex: number,
    options: { settled: boolean } = { settled: true },
  ): void {
    if (!this.permits(id, 'reordering')) {
      return;
    }
    this.columnStore.move(id, visibleIndex);
    if (options.settled) {
      this.pendingMove = null;
      this.emitEvent('columnMoved', { columnId: id, visibleIndex });
    } else {
      this.pendingMove = { columnId: id, visibleIndex };
    }
  }

  /** Writes the two-way `hiddenColumns`, which the visibility effect reports. */
  private applyColumnVisible(id: string, visible: boolean): void {
    const hidden = this.hiddenColumns();
    if (visible) {
      if (hidden.includes(id)) {
        this.hiddenColumns.set(hidden.filter((entry) => entry !== id));
      }
      return;
    }
    if (!this.permits(id, 'hiding')) {
      return;
    }
    if (!hidden.includes(id)) {
      this.hiddenColumns.set([...hidden, id]);
    }
  }

  /**
   * Pins or unpins a column. The grid's own columns keep the side they
   * declare. Pinning moves a column to an edge, so it answers to the same
   * capability reordering does.
   */
  private applyColumnPin(id: string, side: 'start' | 'end' | false): void {
    if (!this.permitsCapability('reordering')) {
      return;
    }
    if (isBuiltInColumn(id)) {
      if (isDevMode()) {
        console.warn(`datagrid: column "${id}" does not allow pinning.`);
      }
      return;
    }
    this.columnStore.pin(id, side);
  }

  /**
   * Converts a position among the rendered columns into one among the host's
   * columns, which is the only order {@link ColumnStore} knows about.
   */
  private toHostIndex(renderedIndex: number): number {
    const built = this.layout()
      .columns.slice(0, renderedIndex)
      .filter((entry) => isBuiltInColumn(entry.id)).length;
    return Math.max(0, renderedIndex - built);
  }

  /** Moves the definitions' declared visibility into the hidden model. */
  private applyDeclaredVisibility(columns: readonly ColumnDef<TRow>[]): void {
    const next = seedHiddenColumns(columns, this.hiddenColumns(), this.declaredVisibility);
    if (next != null) {
      this.hiddenColumns.set(next);
    }
  }

  private columnById(id: string): ColumnDef<TRow> | undefined {
    return this.columnStore.columns().find((column) => column.id === id);
  }

  // --- Paging ----------------------------------------------------------

  /**
   * The page-size selector. Writes the size alone: the query store snaps the
   * index back to the first page itself, and the write-back effect carries
   * that into the `pageIndex` model.
   */
  protected onPageSizeChange(size: number | undefined): void {
    if (size == null || !this.permitsCapability('paging')) {
      return;
    }
    const normalized = normalizePageSize(size);
    if (normalized == null || normalized === this.effectivePageSize()) {
      return;
    }
    this.pageSize.set(normalized);
  }

  protected onPaginate(state: PaginatorState): void {
    if (!this.permitsCapability('paging')) {
      return;
    }
    this.pageSize.set(state.rows);
    this.pageIndex.set(state.page - 1);
    this.announcement.set(
      this.transloco.translate(this.copy('datagrid.announce.page'), {
        page: state.page,
        pages: Math.max(1, state.pageCount),
      }),
    );
  }

  private setUpInfiniteScroll(): void {
    effect(() => {
      // The window reaching the end of the loaded rows is the table's trigger,
      // and it is a virtualized window: it grows as the reader scrolls. The
      // card list renders every loaded row, so its window covers all of them
      // the moment a page lands — the test below would be true at once and
      // again after each answer, and the whole dataset would arrive in one go.
      // There the sentinel crossing the fold is the only honest trigger.
      if (this.resolvedPagingMode() !== 'infinite' || this.cardView()) {
        return;
      }
      const window = this.rowWindow();
      const loaded = this.dataRows().length;
      const total = this.dataStore.totalCount();
      const loading = this.dataStore.loading();
      if (
        shouldLoadMore({
          windowEnd: window.end,
          loadedRows: loaded,
          total,
          threshold: this.overscan() * 2,
          loading,
        })
      ) {
        untracked(() => {
          this.loadMore();
        });
      }
    });
  }

  protected onClearFilters(): void {
    this.clearAllFilters();
    this.clearFilters.emit();
  }

  private rowFor(key: GridKey): TRow | undefined {
    const index = this.keyIndex().get(key);
    return index === undefined ? undefined : this.dataRows()[index];
  }

  private directionFor(event: KeyboardEvent): FocusDirection | null {
    switch (event.key) {
      case 'ArrowLeft':
        return 'left';
      case 'ArrowRight':
        return 'right';
      case 'ArrowUp':
        return 'up';
      case 'ArrowDown':
        return 'down';
      case 'Home':
        return event.ctrlKey || event.metaKey ? 'gridStart' : 'rowStart';
      case 'End':
        return event.ctrlKey || event.metaKey ? 'gridEnd' : 'rowEnd';
      case 'PageUp':
        return 'pageUp';
      case 'PageDown':
        return 'pageDown';
      default:
        return null;
    }
  }

  private revealRow(index: number): void {
    const element = this.viewportRef()?.nativeElement;
    if (element == null) {
      return;
    }
    const offset = offsetToRevealEntry(this.offsets(), {
      index,
      scrollTop: this.scrollTop(),
      viewportHeight: this.viewportHeight(),
    });
    if (offset == null) {
      return;
    }
    element.scrollTop = offset;
    // Written eagerly so the window includes the row in this same pass, before
    // the asynchronous scroll event arrives.
    this.scrollTop.set(offset);
  }

  /**
   * Scrolls a column just inside the viewport. Pinned columns are already
   * always visible, and their widths are the part of the viewport a scrolled
   * column cannot occupy.
   */
  private revealColumn(id: string): void {
    const element = this.viewportRef()?.nativeElement;
    const columns = this.layout().columns;
    const index = columns.findIndex((entry) => entry.id === id);
    if (element == null || index < 0 || columns[index].pinned !== false) {
      return;
    }
    let left = 0;
    let pinnedStart = 0;
    let pinnedEnd = 0;
    for (const [position, entry] of columns.entries()) {
      if (entry.pinned === 'start') {
        pinnedStart += entry.width;
      } else if (entry.pinned === 'end') {
        pinnedEnd += entry.width;
      }
      if (position < index) {
        left += entry.width;
      }
    }
    const width = columns[index].width;
    const viewStart = element.scrollLeft + pinnedStart;
    const viewEnd = element.scrollLeft + element.clientWidth - pinnedEnd;
    if (left < viewStart) {
      this.applyScrollPosition({ top: this.scrollTop(), left: Math.max(0, left - pinnedStart) });
    } else if (left + width > viewEnd) {
      this.applyScrollPosition({
        top: this.scrollTop(),
        left: left + width + pinnedEnd - element.clientWidth,
      });
    }
  }

  /**
   * Sets the scroll offsets. Before the viewport exists the request is held
   * and applied on first render, which is what makes a call from a host that
   * resolved its reference a tick early safe rather than lost.
   */
  private applyScrollPosition(position: { top: number; left: number }): void {
    const element = this.viewportRef()?.nativeElement;
    if (element == null) {
      this.pendingScroll = position;
      return;
    }
    element.scrollTop = position.top;
    element.scrollLeft = position.left;
    // Written eagerly so the row window includes the destination in this same
    // pass, before the asynchronous scroll event arrives.
    this.scrollTop.set(position.top);
    this.scrollLeft.set(position.left);
  }

  private applyPendingScroll(element: HTMLElement): void {
    const pending = this.pendingScroll;
    if (pending == null) {
      return;
    }
    this.pendingScroll = null;
    element.scrollTop = pending.top;
    element.scrollLeft = pending.left;
    this.scrollTop.set(pending.top);
    this.scrollLeft.set(pending.left);
  }

  private applyDomFocus(cell: CellPosition): void {
    const host = this.viewportRef()?.nativeElement;
    if (host == null) {
      return;
    }
    if (this.cardView()) {
      this.applyCardFocus(host, cell);
      return;
    }
    const keyText = serializeKey(cell.key);
    // Matched by reading attributes rather than by a selector: a key may hold
    // any character, and `CSS.escape` is not available everywhere.
    for (const rowElement of host.querySelectorAll('[role="row"]')) {
      if (rowElement.getAttribute('data-key') !== keyText) {
        continue;
      }
      const cellElements = rowElement.querySelectorAll('[role="gridcell"]');
      for (const cellElement of cellElements) {
        if (cellElement.getAttribute('data-column') === cell.columnId) {
          (cellElement as HTMLElement).focus();
          return;
        }
      }
      // A group row draws one label cell, whichever column the walk arrived
      // from. The focus store keeps the logical column so the walk resumes in
      // it; the label is what takes the focus.
      if (rowElement.getAttribute('data-row-kind') === 'group') {
        (cellElements[0] as HTMLElement | undefined)?.focus();
      }
      return;
    }
  }

  private measure(element: HTMLElement): void {
    this.viewportHeight.set(element.clientHeight);
    this.viewportWidth.set(element.clientWidth);
  }

  /** Applies the columns' declared sort once, if the host set none of its own. */
  /**
   * Writes each column's `filter.initial` once, as the sort seed does. Reset seeds it again,
   * so the declared filter is what "back to the start" means.
   */
  private seedFilters(columns: readonly ColumnDef<TRow>[]): void {
    if (this.filtersSeeded || columns.length === 0) {
      return;
    }
    this.filtersSeeded = true;
    const present = this.queryStore.relativeDateFilters();
    for (const column of columns) {
      const relative = column.filter?.initial?.relative;
      if (relative != null && !present.has(column.id)) {
        this.queryStore.setRelativeDateFilter(column.id, {
          field: columnField(column),
          filter: relative,
        });
      }
    }
  }

  private seedSort(columns: readonly ColumnDef<TRow>[]): void {
    if (this.sortSeeded || columns.length === 0) {
      return;
    }
    this.sortSeeded = true;
    if (this.sort().length > 0) {
      return;
    }
    const seed = initialSort(columns);
    if (seed.length > 0) {
      this.sort.set(seed);
    }
  }

  private announceGrouping(specs: readonly GroupSpec[]): void {
    if (specs.length === 0) {
      this.announcement.set(
        this.transloco.translate(this.copy('datagrid.announce.groupingCleared')),
      );
      return;
    }
    const byField = this.columnsByField();
    this.announcement.set(
      this.transloco.translate(this.copy('datagrid.announce.grouped'), {
        columns: specs
          .map((spec) => {
            const column = byField.get(spec.field);
            return column?.caption ?? column?.field ?? spec.field;
          })
          .join(', '),
      }),
    );
  }

  private announceSelection(): void {
    const count = this.selectionStore.selectedCount();
    this.announcement.set(
      count == null
        ? this.transloco.translate(this.copy('datagrid.announce.selectedAll'))
        : this.transloco.translate(this.copy('datagrid.announce.selected'), { count }),
    );
  }

  private setUpAnnouncements(): void {
    effect((onCleanup) => {
      const settled = this.dataStore.settled();
      const loading = this.dataStore.loading();
      const count = this.dataRows().length;
      if (!settled || loading || !this.ready()) {
        return;
      }
      // Summarised and debounced: a burst of loads announces once.
      const timer = setTimeout(() => {
        // A sort or a page change reloads without changing how many rows
        // matched. Repeating the count there would talk over the message
        // that says what the user actually did.
        if (count === this.announcedCount) {
          return;
        }
        this.announcedCount = count;
        this.announcement.set(
          count === 1
            ? this.transloco.translate(this.copy('datagrid.loadedOne'))
            : this.transloco.translate(this.copy('datagrid.loaded'), { count }),
        );
      }, 400);
      onCleanup(() => {
        clearTimeout(timer);
      });
    });
  }

  /** The column a summary aligns under: its own declaration, or the one on its field. */
  private summaryColumnId(summary: SummaryConfig): string {
    return summary.columnId ?? this.columnsByField().get(summary.field)?.id ?? summary.field;
  }

  /** Exposed for specs and for the header, which reads captions the same way. */
  protected fieldOf(column: ColumnDef<TRow>): string {
    return columnField(column);
  }
}

/**
 * Whether a load projected to `select` brought `field`. `null` is no projection, which
 * brings every field. A dotted path counts when its root or the path itself was selected.
 */
function projectionCovers(select: readonly string[] | null, field: string | undefined): boolean {
  if (select === null || field === undefined) {
    return true;
  }
  return select.some(
    (selected) =>
      selected === field || field.startsWith(`${selected}.`) || selected.startsWith(`${field}.`),
  );
}
