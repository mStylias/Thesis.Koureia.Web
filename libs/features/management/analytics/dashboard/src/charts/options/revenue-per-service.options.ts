import type { SeriesSetViewDto } from '@api/analytics';
import { chartInkOn, type ChartOption } from '@ui/chart';

import { baseOption, tooltipHtml } from './chart-base';
import { categorySwatches } from './bookings-per-service.options';
import { swatch } from './chart-colors';
import { categoryLabel, hasValue, seriesName, seriesValues } from './chart-data';
import type { ChartContext } from './chart-options.types';

/** The height of a category's name band, in px. */
const UPPER_LABEL_HEIGHT = 22;

/**
 * The smallest share of the revenue that gets a name band. The band of a smaller category takes
 * all of its area, and its services shrink to a hairline. Without the band, the services fill
 * the category, and the tooltip names the category.
 */
const UPPER_LABEL_MIN_SHARE = 0.1;

/** The node names from the top category down to the hovered node. The root is left out. */
function treePath(params: unknown): string[] {
  const info = (params as { treePathInfo?: unknown } | null)?.treePathInfo;
  if (!Array.isArray(info)) return [];
  return info.slice(1).flatMap((node: unknown) => {
    const name = (node as { name?: unknown } | null)?.name;
    return typeof name === 'string' ? [name] : [];
  });
}

/**
 * `revenuePerService` on the Services tab: a treemap, category → service, built from
 * `parentKey`. A category item already holds the sum of its services, so it takes its own
 * value and ECharts does not add the services again. Each category has one swatch, from
 * `colors`. Its name band is neutral, and its services fill it in the swatch. A category below
 * `UPPER_LABEL_MIN_SHARE` of the revenue has no band.
 */
export function revenuePerServiceOption(
  set: SeriesSetViewDto,
  ctx: ChartContext,
  colors: ReadonlyMap<string, string> = categorySwatches(set, ctx),
): ChartOption {
  const { tokens } = ctx;
  const revenue = seriesValues(set, 'revenue');
  const items = set.axis.items;
  const money = (value: unknown): string =>
    ctx.format.tooltip(typeof value === 'number' ? value : null, 'Money');

  const total = items.reduce(
    (sum, item, index) => sum + (item.parentKey === null ? (revenue[index] ?? 0) : 0),
    0,
  );

  const data = items
    .flatMap((item, index) => (item.parentKey === null ? [{ item, index }] : []))
    .map(({ item, index }, order) => {
      const color = colors.get(item.key) ?? swatch(ctx, colors.size + order);
      const ink = chartInkOn(tokens, color);
      const own = revenue[index] ?? null;
      const banded = total > 0 && (own ?? 0) / total >= UPPER_LABEL_MIN_SHARE;
      return {
        id: item.key,
        name: categoryLabel(item, ctx),
        value: own,
        itemStyle: { color, borderColor: tokens.surfaceSunken, borderWidth: 2, gapWidth: 2 },
        upperLabel: banded
          ? { show: true, height: UPPER_LABEL_HEIGHT, color: tokens.textPrimary }
          : { show: false },
        children: items.flatMap((child, childIndex) => {
          const value = revenue[childIndex] ?? null;
          // A service with no revenue has no area to draw.
          if (child.parentKey !== item.key || !hasValue(value)) return [];
          return [
            {
              id: child.key,
              name: categoryLabel(child, ctx),
              value,
              itemStyle: { color },
              label: { color: ink },
            },
          ];
        }),
      };
    })
    .filter((node) => hasValue(node.value));

  return {
    ...baseOption(ctx),
    tooltip: {
      trigger: 'item',
      formatter: (params: unknown) => {
        const value = (params as { value?: unknown } | null)?.value;
        const color = (params as { color?: unknown } | null)?.color;
        return tooltipHtml(treePath(params).join(' › '), [
          {
            name: seriesName('revenue', ctx),
            value: money(value),
            color: typeof color === 'string' ? color : undefined,
          },
        ]);
      },
    },
    series: [
      {
        type: 'treemap',
        name: seriesName('revenue', ctx),
        data,
        left: 0,
        right: 0,
        top: 0,
        bottom: 0,
        roam: false,
        nodeClick: false,
        breadcrumb: { show: false },
        label: {
          show: true,
          overflow: 'truncate',
          formatter: (params: { name?: string; value?: unknown }) =>
            `${params.name ?? ''}\n${money(params.value)}`,
        },
        upperLabel: {
          show: true,
          height: UPPER_LABEL_HEIGHT,
          overflow: 'truncate',
          formatter: (params: { name?: string; value?: unknown }) =>
            `${params.name ?? ''} · ${money(params.value)}`,
        },
        // The root: the card's surface shows between the categories.
        levels: [{ itemStyle: { borderWidth: 0, gapWidth: 4, borderColor: tokens.surface } }],
      },
    ],
  };
}
