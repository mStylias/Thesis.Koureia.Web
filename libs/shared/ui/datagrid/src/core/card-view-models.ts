/**
 * Builds what the card list draws: one view model per card (§5.4).
 *
 * It sits beside {@link RowViewModels} rather than inside it because the two
 * produce different shapes from the same inputs — a cell knows its column
 * track, its sticky inset and its flash history, and a card field knows its
 * caption. What they share is reached through the same deps: the resolved cell
 * renderers, the display resolution and the decoration callbacks, so a value
 * reads identically in both presentations.
 *
 * There is no change flash here. The flash marks a value that moved under the
 * user's eye in a dense table; a card is read one record at a time, and a wash
 * over a stacked field says only that something reloaded.
 */
import { formatCellText, formatGroupValue, resolveCellValue } from './format';
import { groupFocusKey } from './grouping/body-items';
import { GROUP_PATH_SEPARATOR } from './grouping/group-nodes';
import { decorationAria, decorationStyles } from './decoration';
import { serializeKey } from './keys';
import { noRenderer } from './renderer-ref';
import { formatSummary, summaryKey } from './summaries';
import type { CachedCard, CardViewModelDeps, CardViewModelItem } from './card-view-models.types';
import type { CardFieldEntry } from './card-fields.types';
import type { GroupNode } from './grouping/group-nodes.types';
import type { CardContext } from './types/card.types';
import type { SummaryConfig } from './types/config.types';
import type {
  CellContext,
  DetailContext,
  GroupRowContext,
  GroupRowTemplateContext,
} from './types/context.types';
import type { GridKey } from './types/key.types';
import { componentRenderer, withImplicit } from '../datagrid.internals';
import type {
  DatagridRenderCard,
  DatagridRenderCardDetail,
  DatagridRenderCardField,
  DatagridRenderCardGroup,
  DatagridRenderSummary,
} from '../datagrid.types';

export class CardViewModels<TRow> {
  private readonly cache = new Map<GridKey, CachedCard<TRow>>();
  /** Bumped whenever every cached card is stale, whatever its own inputs say. */
  private version = 0;

  constructor(private readonly deps: CardViewModelDeps<TRow>) {}

  /** Drops every cached card. For a repaint or a wholesale data replacement. */
  invalidateAll(): void {
    this.version += 1;
    this.cache.clear();
  }

  /** Keeps the cache from growing past a few pages of cards. */
  prune(liveKeys: readonly GridKey[]): void {
    if (this.cache.size <= liveKeys.length * 2 + 32) {
      return;
    }
    const keep = new Set(liveKeys);
    for (const key of [...this.cache.keys()]) {
      if (!keep.has(key)) {
        this.cache.delete(key);
      }
    }
  }

  card(item: CardViewModelItem<TRow>): DatagridRenderCard<TRow> {
    const { key, row } = item;
    const plan = this.deps.plan();
    const selected = this.deps.isSelected(key);
    const expanded = this.deps.hasDetail() ? this.deps.isExpanded(key) : null;
    const cached = this.cache.get(key);
    if (
      cached?.row === row &&
      cached.index === item.dataIndex &&
      cached.selected === selected &&
      cached.expanded === expanded &&
      cached.plan === plan &&
      cached.renderVersion === this.version
    ) {
      return cached.vm;
    }

    const field = (entry: CardFieldEntry<TRow>): DatagridRenderCardField<TRow> =>
      this.field(entry, item, selected, expanded);
    const renderer = this.deps.cardRenderer();
    const rendered = renderer.template != null || renderer.component != null;
    const context = rendered
      ? withImplicit<CardContext<TRow>>({
          row,
          key,
          rowIndex: item.dataIndex,
          selected,
          expanded,
          columns: plan.all.map((entry) => entry.column),
          api: this.deps.api(),
        })
      : null;
    const decoration = this.deps.decorateRow()?.(row) ?? null;
    const vm: DatagridRenderCard<TRow> = {
      kind: 'card',
      key,
      keyText: serializeKey(key),
      row,
      index: item.dataIndex,
      selected,
      expanded,
      title: plan.title == null ? null : field(plan.title),
      subtitle: plan.subtitle == null ? null : field(plan.subtitle),
      media: plan.media == null ? null : field(plan.media),
      meta: plan.meta.map(field),
      fields: plan.fields.map(field),
      actions: plan.actions.map(field),
      template: renderer.template,
      component: componentRenderer(renderer.component, context),
      context,
      classes: decoration?.classes?.join(' ') ?? null,
      styles: decorationStyles(decoration),
      aria: decorationAria(decoration),
    };
    this.cache.set(key, {
      row,
      index: item.dataIndex,
      selected,
      expanded,
      plan,
      renderVersion: this.version,
      vm,
    });
    return vm;
  }

  private field(
    entry: CardFieldEntry<TRow>,
    item: CardViewModelItem<TRow>,
    selected: boolean,
    expanded: boolean | null,
  ): DatagridRenderCardField<TRow> {
    const { column } = entry;
    const { row, key } = item;
    const value = resolveCellValue(row, column);
    const displayValue = this.deps.displayFor(row, column, value);
    const renderer = this.deps.cellRenderers().get(entry.id) ?? noRenderer();
    const rendered = renderer.template != null || renderer.component != null;
    // The same `CellContext` the table builds, so a renderer needs no branch
    // of its own. `focused` is false: focus is per card here, and a field
    // reporting itself focused would draw a ring around one value.
    const context = rendered
      ? withImplicit<CellContext<TRow>>({
          row,
          key,
          rowIndex: item.dataIndex,
          column,
          value,
          displayValue,
          state: { selected, expanded: expanded === true, editing: false, focused: false },
          api: this.deps.api(),
        })
      : null;
    const decoration = this.deps.decorateCell()?.(row, entry.id) ?? null;
    return {
      columnId: entry.id,
      label: entry.label,
      hideLabel: entry.hideLabel,
      wide: entry.wide,
      text: rendered
        ? ''
        : formatCellText(displayValue, column, {
            booleanLabels: this.deps.booleanLabels(),
            timezone: this.deps.timezone(),
            locale: this.deps.locale(),
          }),
      template: renderer.template,
      component: componentRenderer(renderer.component, context),
      context,
      classes: decoration?.classes?.join(' ') ?? null,
      styles: decorationStyles(decoration),
      aria: decorationAria(decoration),
    };
  }

  /**
   * A group heading. Not cached, for the same reason the table's group row is
   * not: a page carries a handful of them against a page of cards.
   */
  group(
    node: GroupNode<TRow>,
    expanded: boolean,
    summaries: readonly SummaryConfig[],
  ): DatagridRenderCardGroup<TRow> {
    const column = this.deps.columnsByField().get(node.field) ?? null;
    const key = groupFocusKey(node.path);
    const displayValue = formatGroupValue(
      node.value,
      node.field,
      this.deps.columnsByField(),
      this.deps.booleanLabels(),
    );
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
      kind: 'cardGroup',
      key,
      keyText: serializeKey(key),
      path: node.path,
      level: node.level,
      expanded,
      caption: column?.caption ?? column?.field ?? node.field,
      text: displayValue,
      count: node.count,
      // Every group aggregate reads inline. A card list has no column tracks
      // for a `'column'` or `'footer'` placement to align under, so folding
      // them in is the only way they reach the reader at all.
      summaries: this.summaryList(summaries, node.aggregates),
      template: renderer.template,
      component: componentRenderer(renderer.component, context),
      context,
    };
  }

  detail(key: GridKey, row: TRow): DatagridRenderCardDetail<TRow> {
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
    // `data-key` as the card it belongs to, which focus matching reads.
    const detailKey = `${GROUP_PATH_SEPARATOR}detail${GROUP_PATH_SEPARATOR}${serializeKey(key)}`;
    return {
      kind: 'cardDetail',
      key: detailKey,
      keyText: detailKey,
      template: renderer.template,
      component: componentRenderer(renderer.component, context),
      context,
    };
  }

  /**
   * Aggregates as label-and-value pairs. Public because the grid's own totals
   * read the same way in this presentation: there are no column tracks for a
   * footer row to align under, so the totals are a strip under the list.
   */
  summaryList(
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
