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
import { axisLabels, seriesName, seriesValues } from './chart-data';
import type { ChartContext } from './chart-options.types';

/** The ISO weekday of a `YYYY-MM-DD`, Monday 1 to Sunday 7. `null` for a bad date. */
export function isoWeekday(day: string | null): number | null {
  if (day === null) return null;
  const date = new Date(`${day}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return null;
  return date.getUTCDay() === 0 ? 7 : date.getUTCDay();
}

/**
 * `upcomingLoad`: one bar per day of the next 14 days, from today. It ignores the dates of the
 * toolbar. The tooltip adds the weekday and the booked time.
 */
export function upcomingLoadOption(set: SeriesSetViewDto, ctx: ChartContext): ChartOption {
  const labels = axisLabels(set, ctx);
  const appointments = seriesValues(set, 'appointments');
  const minutes = seriesValues(set, 'bookedMinutes');
  const color = swatch(ctx, 0);
  const name = seriesName('appointments', ctx);

  return {
    ...baseOption(ctx),
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'shadow' },
      formatter: (params: unknown) => {
        const index = tooltipIndex(params);
        const weekday = isoWeekday(set.axis.items[index]?.fromDate ?? null);
        const label = labels[index] ?? '';
        const shown = tooltipSeries(params).length > 0;
        return tooltipHtml(weekday === null ? label : `${ctx.format.weekday(weekday)} ${label}`, [
          ...(shown
            ? [{ name, value: ctx.format.tooltip(appointments[index], 'Count'), color }]
            : []),
          {
            name: seriesName('bookedMinutes', ctx),
            value: ctx.format.tooltip(minutes[index], 'Minutes'),
          },
        ]);
      },
    },
    xAxis: categoryAxis(labels),
    yAxis: valueAxis('Count', ctx, { minInterval: 1 }),
    series: [{ type: 'bar', name, data: appointments, color }],
  };
}
