import type { SeriesSetViewDto } from '@api/analytics';
import type { ChartOption } from '@ui/chart';

import { baseOption, categoryAxis, tooltipHtml, tooltipIndex, valueAxis } from './chart-base';
import { swatch } from './chart-colors';
import { axisLabels, indexesByValue, pickItems, seriesName, seriesValues } from './chart-data';
import type { ChartContext } from './chart-options.types';

/** The set ordered by utilization, highest first. A barber with no working hours is last. */
export function staffUtilizationSet(set: SeriesSetViewDto): SeriesSetViewDto {
  return pickItems(set, indexesByValue(seriesValues(set, 'utilization')));
}

/**
 * A bar series that only writes `text` on the rows where `values` is `null`, at the start of the
 * value axis. A `null` draws no bar, and ECharts gives a missing value no label. So the text
 * sits on a zero-length bar of its own series, laid over the real one.
 */
export function noValueLabels(
  values: readonly (number | null)[],
  text: string,
  ctx: ChartContext,
): Record<string, unknown> {
  return {
    type: 'bar',
    name: text,
    data: values.map((value) =>
      value === null
        ? {
            value: 0,
            label: {
              show: true,
              position: 'right',
              formatter: text,
              color: ctx.tokens.textMuted,
            },
          }
        : null,
    ),
    // Over the real bar, not beside it.
    barGap: '-100%',
    itemStyle: { color: 'transparent' },
    silent: true,
    tooltip: { show: false },
    emphasis: { disabled: true },
  };
}

/**
 * The end of the utilization axis: 100, or the largest value up to the next 10. Booked time can
 * be more than the scheduled time, and a fixed 100 would cut that bar to a full one.
 */
export function utilizationMax(extent: { readonly max: number }): number {
  return Math.max(100, Math.ceil(extent.max / 10) * 10);
}

/**
 * `staffUtilization`: one horizontal bar per barber on a 0–100 % axis that grows past 100 when
 * booked time is more than scheduled time. Then a dashed line marks 100 %. A barber with no
 * working hours has `null`: no bar, and "Χωρίς ωράριο" in its place. The tooltip gives the
 * booked and the available time in hours.
 */
export function staffUtilizationOption(set: SeriesSetViewDto, ctx: ChartContext): ChartOption {
  const sorted = staffUtilizationSet(set);
  const labels = axisLabels(sorted, ctx);
  const utilization = seriesValues(sorted, 'utilization');
  const booked = seriesValues(sorted, 'bookedMinutes');
  const available = seriesValues(sorted, 'availableMinutes');
  const color = swatch(ctx, 0);
  const utilizationName = seriesName('utilization', ctx);
  const noSchedule = ctx.t('managementDashboard.charts.team.staffUtilization.noSchedule');

  return {
    ...baseOption(ctx),
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'shadow' },
      formatter: (params: unknown) => {
        const index = tooltipIndex(params);
        const value = utilization[index] ?? null;
        return tooltipHtml(labels[index] ?? '', [
          {
            name: utilizationName,
            value: value === null ? noSchedule : ctx.format.tooltip(value, 'Percent'),
            color,
          },
          {
            name: seriesName('bookedMinutes', ctx),
            value: ctx.t('managementDashboard.units.hoursOf', {
              booked: ctx.format.hours(booked[index] ?? 0),
              available: ctx.format.hours(available[index] ?? 0),
            }),
          },
        ]);
      },
    },
    xAxis: valueAxis('Percent', ctx, { min: 0, max: utilizationMax }),
    yAxis: { ...categoryAxis(labels), inverse: true },
    series: [
      {
        type: 'bar',
        name: utilizationName,
        data: utilization,
        color,
        barGap: '-100%',
        ...(utilization.some((value) => value !== null && value > 100)
          ? {
              markLine: {
                silent: true,
                symbol: 'none',
                label: { show: false },
                lineStyle: { color: ctx.tokens.textMuted, type: 'dashed' },
                data: [{ xAxis: 100 }],
              },
            }
          : {}),
      },
      noValueLabels(utilization, noSchedule, ctx),
    ],
  };
}
