/**
 * Builds what the body draws: one view model per rendered entry.
 *
 * The row cache lives here because nothing outside reads it. A data row's view
 * model is reused whole while its inputs are unchanged, which is what keeps a
 * scroll frame from rebuilding a window of cells — so the builder owns both the
 * cache and the render version that invalidates it.
 */
import { isBuiltInColumn, ROW_NUMBER_COLUMN_ID } from './builtin-columns';
import { decorationAria, decorationStyles } from './decoration';
import { formatCellText, formatGroupValue, resolveCellValue } from './format';
import { groupFocusKey } from './grouping/body-items';
import { GROUP_PATH_SEPARATOR } from './grouping/group-nodes';
import { serializeKey } from './keys';
import { noRenderer } from './renderer-ref';
import { formatSummary, summaryKey } from './summaries';
import type { GridLayout } from './column-layout.types';
import type { GroupNode } from './grouping/group-nodes.types';
import type { CellPosition } from './types/api.types';
import type { SummaryConfig } from './types/config.types';
import type {
  CellContext,
  CellTemplateContext,
  DetailContext,
  GroupRowContext,
  GroupRowTemplateContext,
  SummaryCellContext,
  SummaryCellTemplateContext,
} from './types/context.types';
import type { GridKey } from './types/key.types';
import {
  componentRenderer,
  headerCellKind,
  sameCellValue,
  withImplicit,
} from '../datagrid.internals';
import type {
  DatagridRenderCell,
  DatagridRenderDetail,
  DatagridRenderGroupFooter,
  DatagridRenderGroupRow,
  DatagridRenderRow,
  DatagridRenderSummary,
  DatagridRenderSummaryCell,
} from '../datagrid.types';
import type {
  CachedRow,
  RowPlacement,
  RowViewModelDeps,
  RowViewModelItem,
  SummaryCellInput,
} from './row-view-models.types';

export class RowViewModels<TRow> {
  private readonly cache = new Map<GridKey, CachedRow<TRow>>();
  /** Bumped whenever every cached row is stale, whatever its own inputs say. */
  private version = 0;

  constructor(private readonly deps: RowViewModelDeps<TRow>) {}

  /** Drops every cached row. For a repaint or a wholesale data replacement. */
  invalidateAll(): void {
    this.version += 1;
    this.cache.clear();
  }

  /** Drops one cached row, so the next pass rebuilds it. */
  invalidate(key: GridKey): void {
    this.cache.delete(key);
  }

  /** Keeps the cache from growing past a few windows of rows. */
  prune(liveKeys: readonly GridKey[]): void {
    if (this.cache.size <= liveKeys.length * 4 + 32) {
      return;
    }
    const keep = new Set(liveKeys);
    for (const key of [...this.cache.keys()]) {
      if (!keep.has(key)) {
        this.cache.delete(key);
      }
    }
  }

  row(
    item: RowViewModelItem<TRow>,
    placement: RowPlacement,
    layout: GridLayout<TRow>,
    focused: CellPosition | null,
  ): DatagridRenderRow<TRow> {
    const { key, row } = item;
    const { top, ariaRowIndex } = placement;
    const focusedColumnId = focused?.key === key ? focused.columnId : null;
    const selected = this.deps.isSelected(key);
    const expanded = this.deps.hasDetail() ? this.deps.isExpanded(key) : null;
    const cached = this.cache.get(key);
    if (
      cached?.row === row &&
      cached.index === item.dataIndex &&
      cached.ariaRowIndex === ariaRowIndex &&
      cached.top === top &&
      cached.level === item.level &&
      cached.expanded === expanded &&
      cached.layout === layout &&
      cached.renderVersion === this.version &&
      cached.focusedColumnId === focusedColumnId &&
      cached.selected === selected
    ) {
      return cached.vm;
    }
    const renderers = this.deps.cellRenderers();
    const decorateCell = this.deps.decorateCell();
    const booleanLabels = this.deps.booleanLabels();
    const timezone = this.deps.timezone();
    const locale = this.deps.locale();
    const rowIndex = item.dataIndex;
    // A row absent from the cache is either brand new or was pruned while
    // scrolled away. Neither is a value change, so neither may flash.
    const previousValues = cached?.values;
    const previousFlash = new Map(
      cached?.vm.cells.map((cell) => [cell.columnId, cell.flash]) ?? [],
    );
    const values = new Map<string, unknown>();
    // Carried between renders: a column can arrive several renders before the
    // data that fills it, and it must not flash when that data lands.
    const previousArriving = cached?.arriving;
    const arriving = new Set<string>();
    const flashEnabled = this.deps.flashOnChange();
    const cells: DatagridRenderCell<TRow>[] = layout.columns.map((entry, position) => {
      const column = entry.column;
      const base = {
        columnId: entry.id,
        colIndex: position + 1,
        pinned: entry.pinned,
        edge: entry.edge,
        insetStart: entry.pinned === 'start' ? entry.inset : null,
        insetEnd: entry.pinned === 'end' ? entry.inset : null,
      };
      if (isBuiltInColumn(entry.id)) {
        return {
          ...base,
          kind: headerCellKind(entry.id),
          text: entry.id === ROW_NUMBER_COLUMN_ID ? (rowIndex + 1).toString() : '',
          template: null,
          component: null,
          context: null,
          classes: null,
          styles: null,
          aria: null,
          flash: null,
        };
      }
      const value = resolveCellValue(row, column);
      const displayValue = this.deps.displayFor(row, column, value);
      values.set(entry.id, displayValue);
      const carried = previousFlash.get(entry.id) ?? null;
      // Showing a column re-queries for the projection alone, so the rows on
      // screen still carry no field for it. The cell renders empty, then the
      // reload lands and every one of them changes at once — the column
      // arriving, which the user did with the chooser, not an update the data
      // made. Suppressed until the field is there.
      const joined =
        previousValues !== undefined && !previousValues.has(entry.id) && value === undefined;
      const waiting = previousArriving?.has(entry.id) === true;
      if (joined || (waiting && value === undefined)) {
        arriving.add(entry.id);
      }
      const changed =
        flashEnabled &&
        !waiting &&
        previousValues !== undefined &&
        previousValues.has(entry.id) &&
        !sameCellValue(previousValues.get(entry.id), displayValue);
      // Alternating rather than a boolean: the CSS animation restarts only
      // when `animation-name` changes, so a second change to the same cell
      // would otherwise go unmarked.
      const flash = changed ? (carried === 'a' ? 'b' : 'a') : carried;
      const renderer = renderers.get(entry.id) ?? noRenderer<CellTemplateContext<TRow>>();
      const rendered = renderer.template != null || renderer.component != null;
      const context = rendered
        ? withImplicit<CellContext<TRow>>({
            row,
            key,
            rowIndex,
            column,
            value,
            displayValue,
            state: {
              selected,
              expanded: expanded === true,
              editing: false,
              focused: focusedColumnId === entry.id,
            },
            api: this.deps.api(),
          })
        : null;
      const decoration = decorateCell?.(row, entry.id) ?? null;
      return {
        ...base,
        kind: 'data',
        text: rendered
          ? ''
          : formatCellText(displayValue, column, { booleanLabels, timezone, locale }),
        template: renderer.template,
        component: componentRenderer(renderer.component, context),
        context,
        classes: decoration?.classes?.join(' ') ?? null,
        styles: decorationStyles(decoration),
        aria: decorationAria(decoration),
        flash,
      };
    });
    const rowDecoration = this.deps.decorateRow()?.(row) ?? null;
    const vm: DatagridRenderRow<TRow> = {
      kind: 'data',
      key,
      keyText: serializeKey(key),
      row,
      index: rowIndex,
      ariaRowIndex,
      top,
      height: item.height,
      level: item.level,
      selected,
      expanded,
      cells,
      classes: rowDecoration?.classes?.join(' ') ?? null,
      styles: decorationStyles(rowDecoration),
      aria: decorationAria(rowDecoration),
    };
    this.cache.set(key, {
      row,
      index: item.dataIndex,
      ariaRowIndex,
      top,
      level: item.level,
      expanded,
      layout,
      renderVersion: this.version,
      focusedColumnId,
      selected,
      vm,
      values,
      arriving,
    });
    return vm;
  }

  /**
   * A group header row.
   *
   * Not cached: a body carries a handful of group rows against a window of
   * data rows, and the cache exists for the flash history that only data rows
   * have.
   */
  groupRow(
    node: GroupNode<TRow>,
    expanded: boolean,
    placement: RowPlacement,
    layout: GridLayout<TRow>,
  ): DatagridRenderGroupRow<TRow> {
    const column = this.deps.columnsByField().get(node.field) ?? null;
    const key = groupFocusKey(node.path);
    const displayValue = formatGroupValue(
      node.value,
      node.field,
      this.deps.columnsByField(),
      this.deps.booleanLabels(),
    );
    const summaries = this.deps.groupSummaries();
    const inline = summaries.filter((summary) => (summary.placement ?? 'header') === 'header');
    const aligned = summaries.filter((summary) => summary.placement === 'column');
    const cells =
      aligned.length === 0 ? null : this.summaryCells(aligned, node.aggregates, node.path, layout);
    const renderers = this.deps.groupRenderers();
    const renderer =
      renderers.get(column?.id ?? '') ??
      renderers.get('') ??
      noRenderer<GroupRowTemplateContext<TRow>>();
    const rendered = renderer.template != null || renderer.component != null;
    const context = rendered
      ? withImplicit<GroupRowContext<TRow>>({
          path: node.path,
          column,
          value: node.value,
          displayValue,
          level: node.level,
          count: node.count,
          ...(node.aggregates == null ? {} : { aggregates: node.aggregates }),
          expanded,
          toggle: () => {
            this.deps.toggleGroup(node.path);
          },
          api: this.deps.api(),
        })
      : null;
    return {
      kind: 'group',
      key,
      keyText: serializeKey(key),
      path: node.path,
      level: node.level,
      top: placement.top,
      height: this.deps.groupRowHeight(),
      ariaRowIndex: placement.ariaRowIndex,
      expanded,
      columnId: layout.columns[0]?.id ?? '',
      caption: column?.caption ?? column?.field ?? node.field,
      text: displayValue,
      count: node.count,
      summaries: this.inlineSummaries(inline, node.aggregates),
      cells,
      labelSpan: cells == null ? Math.max(1, layout.columns.length) : labelSpanFor(cells, layout),
      template: renderer.template,
      component: componentRenderer(renderer.component, context),
      context,
    };
  }

  groupFooter(
    node: GroupNode<TRow>,
    level: number,
    placement: RowPlacement,
    layout: GridLayout<TRow>,
  ): DatagridRenderGroupFooter<TRow> {
    const key = `${groupFocusKey(node.path).toString()}${GROUP_PATH_SEPARATOR}footer`;
    return {
      kind: 'groupFooter',
      key,
      keyText: key,
      level,
      top: placement.top,
      height: this.deps.groupRowHeight(),
      ariaRowIndex: placement.ariaRowIndex,
      cells: this.summaryCells(
        this.deps.groupSummaries().filter((summary) => summary.placement === 'footer'),
        node.aggregates,
        node.path,
        layout,
      ),
    };
  }

  detail(
    key: GridKey,
    row: TRow,
    height: number,
    placement: RowPlacement,
  ): DatagridRenderDetail<TRow> {
    const renderer = this.deps.detailRenderer();
    const context = withImplicit<DetailContext<TRow>>({
      row,
      key,
      collapse: () => {
        this.deps.collapseRow(key);
      },
      api: this.deps.api(),
    });
    // Prefixed with the separator so a detail entry can never take the same
    // `data-key` as the row it belongs to, which focus matching reads.
    const detailKey = `${GROUP_PATH_SEPARATOR}detail${GROUP_PATH_SEPARATOR}${serializeKey(key)}`;
    return {
      kind: 'detail',
      key: detailKey,
      keyText: detailKey,
      top: placement.top,
      height,
      ariaRowIndex: placement.ariaRowIndex,
      template: renderer.template,
      component: componentRenderer(renderer.component, context),
      context,
    };
  }

  /**
   * One cell per rendered column, holding the summary aligned under it.
   *
   * Columns with no summary still get a cell: the row is a grid of the same
   * tracks as the body, so a missing cell would shift every later value one
   * column to the left.
   */
  summaryCells(
    summaries: readonly SummaryConfig[],
    aggregates: Readonly<Record<string, unknown>> | null,
    path: readonly unknown[] | null,
    layout: GridLayout<TRow>,
  ): DatagridRenderSummaryCell<TRow>[] {
    const byColumn = new Map<string, SummaryConfig>();
    for (const summary of summaries) {
      byColumn.set(this.deps.summaryColumnId(summary), summary);
    }
    const renderers = this.deps.summaryRenderers();
    return layout.columns.map((entry, position) =>
      this.summaryCell({
        entry,
        position,
        summary: byColumn.get(entry.id),
        aggregates,
        path,
        renderers,
      }),
    );
  }

  private summaryCell(input: SummaryCellInput<TRow>): DatagridRenderSummaryCell<TRow> {
    const { entry, summary, aggregates, path, renderers } = input;
    const base = {
      columnId: entry.id,
      colIndex: input.position + 1,
      pinned: entry.pinned,
      edge: entry.edge,
      insetStart: entry.pinned === 'start' ? entry.inset : null,
      insetEnd: entry.pinned === 'end' ? entry.inset : null,
    };
    if (summary === undefined) {
      return { ...base, text: '', template: null, component: null, context: null };
    }
    const value = aggregates?.[summaryKey(summary)] ?? null;
    const text = formatSummary(summary, value);
    const renderer = renderers.get(entry.id) ?? noRenderer<SummaryCellTemplateContext<TRow>>();
    const rendered = renderer.template != null || renderer.component != null;
    const context = rendered
      ? withImplicit<SummaryCellContext<TRow>>({
          summary,
          value,
          displayValue: text,
          path,
          api: this.deps.api(),
        })
      : null;
    return {
      ...base,
      text,
      template: renderer.template,
      component: componentRenderer(renderer.component, context),
      context,
    };
  }

  private inlineSummaries(
    summaries: readonly SummaryConfig[],
    aggregates: Readonly<Record<string, unknown>> | null,
  ): DatagridRenderSummary[] {
    if (summaries.length === 0 || aggregates == null) {
      return [];
    }
    return summaries.map((summary) => ({
      labelKey: `datagrid.aggregate.${summary.type}`,
      text: formatSummary(summary, aggregates[summaryKey(summary)]),
    }));
  }
}

/** How many leading tracks a group label may occupy before the first aggregate. */
function labelSpanFor<TRow>(
  cells: readonly DatagridRenderSummaryCell<TRow>[],
  layout: GridLayout<TRow>,
): number {
  const first = cells.reduce(
    (lowest, cell) => Math.min(lowest, cell.colIndex),
    layout.columns.length + 1,
  );
  return Math.max(1, first - 1);
}
