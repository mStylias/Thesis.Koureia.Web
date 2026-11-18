import type { SeriesSetViewDto } from '@api/analytics';
import type { ChartOption } from '@ui/chart';

import {
  baseOption,
  categoryAxis,
  chartLegend,
  tooltipHtml,
  tooltipIndex,
  tooltipSeries,
  valueAxis,
} from './chart-base';
import { statusBars } from './chart-colors';
import { axisLabels } from './chart-data';
import type { ChartContext, TooltipRow } from './chart-options.types';

/**
 * `appointmentsPerStaff`: one stacked horizontal bar per barber, one segment per status in its
 * tone. The server sorts the barbers by booked appointments, and the first is on top. A status
 * with no appointment is left out of the bars and the legend.
 */
export function appointmentsPerStaffOption(set: SeriesSetViewDto, ctx: ChartContext): ChartOption {
  const labels = axisLabels(set, ctx);
  const bars = statusBars(set, ctx);

  return {
    ...baseOption(ctx),
    legend: chartLegend(bars.legend),
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'shadow' },
      formatter: (params: unknown) => {
        const index = tooltipIndex(params);
        const rows = tooltipSeries(params).map((param): TooltipRow => ({
          name: param.seriesName,
          value: ctx.format.tooltip(typeof param.value === 'number' ? param.value : null, 'Count'),
          color: param.color,
        }));
        return tooltipHtml(labels[index] ?? '', rows);
      },
    },
    xAxis: valueAxis('Count', ctx, { minInterval: 1 }),
    // Inverse, so the first barber is on top.
    yAxis: { ...categoryAxis(labels), inverse: true },
    series: bars.series,
  };
}
