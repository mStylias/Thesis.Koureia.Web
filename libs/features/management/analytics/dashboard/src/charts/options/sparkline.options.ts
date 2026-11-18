import type { SeriesSetViewDto } from '@api/analytics';
import type { ChartOption } from '@ui/chart';

import { axisLabels, hasIsolatedValue, isIsolatedValue, seriesValues } from './chart-data';
import type { ChartContext } from './chart-options.types';

/**
 * A KPI's `trend` (one series, key `value`) as a small line with no axes, no legend and no
 * tooltip. A `null` bucket is a gap. A value with `null` on both sides, a single bucket too,
 * draws as a point, because a line draws nothing for it.
 */
export function sparklineOption(set: SeriesSetViewDto, ctx: ChartContext): ChartOption {
  const values = seriesValues(set, 'value');
  return {
    grid: { left: 2, right: 2, top: 4, bottom: 4 },
    tooltip: { show: false },
    legend: { show: false },
    xAxis: { type: 'category', show: false, boundaryGap: false, data: axisLabels(set, ctx) },
    yAxis: { type: 'value', show: false, scale: true },
    series: [
      {
        type: 'line',
        data: values,
        color: ctx.tokens.accent,
        silent: true,
        connectNulls: false,
        // A marker on the lone values only. ECharts must draw each one, or it can drop them.
        showSymbol: hasIsolatedValue(values),
        showAllSymbol: true,
        symbol: (_value: unknown, params: { readonly dataIndex: number }) =>
          isIsolatedValue(values, params.dataIndex) ? 'circle' : 'none',
        symbolSize: 4,
        // The theme's surface ring would hide a point this small.
        itemStyle: { borderWidth: 0 },
        lineStyle: { width: 1.5 },
      },
    ],
  };
}
