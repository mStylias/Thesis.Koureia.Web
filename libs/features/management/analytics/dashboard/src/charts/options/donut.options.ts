import type { SeriesSetViewDto } from '@api/analytics';
import type { ChartOption } from '@ui/chart';

import { baseOption, chartLegend, tooltipHtml } from './chart-base';
import { alphaFill } from './chart-colors';
import { axisLabels, hasValue, seriesByKey, seriesName, seriesValues } from './chart-data';
import type { ChartContext } from './chart-options.types';
import type { DonutParams, DonutStyler } from './donut.options.types';

function numberOf(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

/** The ring's inner and outer radius. The ring leaves room for a label beside it on a phone. */
export const DONUT_RADIUS = ['32%', '50%'] as const;

/** Both parts of a slice's label line, in px. */
export const DONUT_LABEL_LINE = 8;

/**
 * A donut of one series over a category axis: one slice per item. An item with `0` or `null`
 * draws nothing, so it gets no slice and no legend entry. The table still lists it.
 *
 * A slice label gives the share and the value. The legend above the chart names the slices, so a
 * long name never has to fit beside a narrow ring. A lone slice has no legend: its label, below
 * the ring, names it.
 */
export function donutOption(
  set: SeriesSetViewDto,
  ctx: ChartContext,
  key: string,
  style: DonutStyler,
): ChartOption {
  const labels = axisLabels(set, ctx);
  const values = seriesValues(set, key);
  const unit = seriesByKey(set, key)?.unit ?? 'Count';
  const name = seriesName(key, ctx);
  const slices = set.axis.items.flatMap((item, index) => {
    const value = values[index];
    if (!hasValue(value)) return [];
    const slice = style(item.key, index);
    return [{ name: labels[index] ?? item.key, value, legend: slice, itemStyle: alphaFill(slice) }];
  });
  const named = slices.length === 1;
  const share = (percent: unknown): string => ctx.format.value(numberOf(percent), 'Percent');

  return {
    ...baseOption(ctx),
    legend: chartLegend(
      slices.map((slice) => ({
        name: slice.name,
        color: slice.legend.color,
        opacity: slice.legend.opacity,
      })),
    ),
    tooltip: {
      trigger: 'item',
      formatter: (params: unknown) => {
        const slice = params as DonutParams;
        const title = typeof slice.name === 'string' ? slice.name : '';
        const value = ctx.format.tooltip(numberOf(slice.value), unit);
        return tooltipHtml(title, [
          {
            name,
            value: `${value} (${share(slice.percent)})`,
            color: typeof slice.color === 'string' ? slice.color : undefined,
          },
        ]);
      },
    },
    series: [
      {
        type: 'pie',
        name,
        radius: [...DONUT_RADIUS],
        center: ['50%', '50%'],
        percentPrecision: 1,
        label: {
          formatter: (params: unknown) => {
            const slice = params as DonutParams;
            const lines = [share(slice.percent), ctx.format.value(numberOf(slice.value), unit)];
            if (named && typeof slice.name === 'string') lines.unshift(slice.name);
            return lines.join('\n');
          },
          // A lone slice's name wraps between words.
          overflow: 'break',
        },
        labelLine: { length: DONUT_LABEL_LINE, length2: DONUT_LABEL_LINE },
        data: slices.map((slice) => ({
          name: slice.name,
          value: slice.value,
          itemStyle: slice.itemStyle,
        })),
      },
    ],
  };
}
