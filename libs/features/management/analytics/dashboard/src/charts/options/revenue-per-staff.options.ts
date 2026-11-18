import type { SeriesSetViewDto } from '@api/analytics';
import type { ChartOption } from '@ui/chart';

import {
  baseOption,
  categoryAxis,
  tooltipHtml,
  tooltipIndex,
  tooltipSeries,
  valueAxis,
} from './chart-base';
import { swatch } from './chart-colors';
import { axisLabels, indexesByValue, pickItems, seriesName, seriesValues } from './chart-data';
import type { ChartContext } from './chart-options.types';

/** The set ordered by revenue, largest first. The API sorts it so, and this keeps it so. */
export function revenuePerStaffSet(set: SeriesSetViewDto): SeriesSetViewDto {
  return pickItems(set, indexesByValue(seriesValues(set, 'revenue')));
}

/**
 * `revenuePerStaff`: one horizontal bar per barber, the largest on top. The axis shows the
 * names the server sends, and the tooltip adds the completed appointments.
 */
export function revenuePerStaffOption(set: SeriesSetViewDto, ctx: ChartContext): ChartOption {
  const sorted = revenuePerStaffSet(set);
  const labels = axisLabels(sorted, ctx);
  const revenue = seriesValues(sorted, 'revenue');
  const completed = seriesValues(sorted, 'completedAppointments');
  const color = swatch(ctx, 0);
  const revenueName = seriesName('revenue', ctx);

  return {
    ...baseOption(ctx),
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'shadow' },
      formatter: (params: unknown) => {
        const index = tooltipIndex(params);
        const shown = tooltipSeries(params).length > 0;
        return tooltipHtml(labels[index] ?? '', [
          ...(shown
            ? [{ name: revenueName, value: ctx.format.tooltip(revenue[index], 'Money'), color }]
            : []),
          {
            name: seriesName('completedAppointments', ctx),
            value: ctx.format.tooltip(completed[index], 'Count'),
          },
        ]);
      },
    },
    xAxis: valueAxis('Money', ctx),
    // Inverse, so the first item, the largest, is on top.
    yAxis: { ...categoryAxis(labels), inverse: true },
    series: [{ type: 'bar', name: revenueName, data: revenue, color }],
  };
}
