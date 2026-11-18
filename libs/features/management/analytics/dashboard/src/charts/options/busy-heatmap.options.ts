import type { SeriesSetViewDto } from '@api/analytics';
import type { ChartOption } from '@ui/chart';

import { hourAxis, hourLabels } from './busiest-hours.options';
import type { HeatmapCell } from './busy-heatmap.options.types';
import { baseOption, CHART_GRID, categoryAxis, HEATMAP_BOTTOM, tooltipHtml } from './chart-base';
import { seriesName, seriesValues } from './chart-data';
import type { ChartContext } from './chart-options.types';

/** The series keys of the heatmap: ISO weekdays, Monday first. */
const WEEKDAY_KEYS: readonly string[] = ['1', '2', '3', '4', '5', '6', '7'];

/** A heatmap series key as its weekday, `Δευ` for `"1"`. Any other key as its series name. */
export function weekdayName(key: string, ctx: ChartContext): string {
  return WEEKDAY_KEYS.includes(key) ? ctx.format.weekday(key) : seriesName(key, ctx);
}

/**
 * `busyHeatmap`: the appointments per weekday and hour. The hours run along the x axis and the
 * weekdays down the y axis, Monday on top. A `null` value gets no cell, and `0` gets the lightest
 * one. The ramp runs from the sunken surface to the accent.
 */
export function busyHeatmapOption(set: SeriesSetViewDto, ctx: ChartContext): ChartOption {
  const hours = hourLabels(set, ctx);
  const days = WEEKDAY_KEYS.map((key) => weekdayName(key, ctx));
  const cells: HeatmapCell[] = WEEKDAY_KEYS.flatMap((key, day) =>
    seriesValues(set, key).flatMap((value, hour): HeatmapCell[] =>
      value === null ? [] : [[hour, day, value]],
    ),
  );
  // At least 1, so a set of zeros still has a ramp.
  const max = Math.max(1, ...cells.map((cell) => cell[2]));
  const name = seriesName('appointments', ctx);

  return {
    ...baseOption(ctx),
    // Room under the hour labels for the ramp.
    grid: { ...CHART_GRID, bottom: HEATMAP_BOTTOM },
    tooltip: {
      trigger: 'item',
      formatter: (params: unknown) => {
        const value = (params as { value?: unknown } | null)?.value;
        if (!Array.isArray(value)) return '';
        const [hour, day, count] = value as unknown[];
        const title = `${days[Number(day)] ?? ''} ${hours[Number(hour)] ?? ''}`;
        return tooltipHtml(title.trim(), [
          { name, value: ctx.format.tooltip(typeof count === 'number' ? count : null, 'Count') },
        ]);
      },
    },
    xAxis: { ...hourAxis(hours), splitArea: { show: false } },
    // Inverse, so Monday is on top.
    yAxis: { ...categoryAxis(days), inverse: true },
    visualMap: {
      type: 'continuous',
      min: 0,
      max,
      calculable: false,
      orient: 'horizontal',
      left: 'center',
      bottom: 0,
      itemWidth: 12,
      itemHeight: 160,
      // The first text is at the high end.
      text: [ctx.format.value(max, 'Count'), ctx.format.value(0, 'Count')],
      inRange: { color: [ctx.tokens.surfaceSunken, ctx.tokens.accent] },
    },
    series: [{ type: 'heatmap', name, data: cells }],
  };
}
