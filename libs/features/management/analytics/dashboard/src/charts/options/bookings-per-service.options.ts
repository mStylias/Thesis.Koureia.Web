import type { AnalyticsAxisItemViewDto, SeriesSetViewDto } from '@api/analytics';
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
import { swatch } from './chart-colors';
import {
  axisLabels,
  categoryLabel,
  indexesByValue,
  pickItems,
  seriesName,
  seriesValues,
} from './chart-data';
import type { ChartContext, TooltipRow } from './chart-options.types';

/** The services of a service set, the items with a parent, most booked first. */
export function bookingsPerServiceSet(set: SeriesSetViewDto): SeriesSetViewDto {
  const services = pickItems(
    set,
    set.axis.items.flatMap((item, index) => (item.parentKey === null ? [] : [index])),
  );
  return pickItems(services, indexesByValue(seriesValues(services, 'bookings')));
}

/**
 * One swatch per category, in the order of `set`: the server puts the largest first. Both charts
 * of the Services tab read the map of `bookingsPerService`, so a category has one color.
 */
export function categorySwatches(
  set: SeriesSetViewDto,
  ctx: ChartContext,
): ReadonlyMap<string, string> {
  return new Map(
    set.axis.items
      .filter((item) => item.parentKey === null)
      .map((item, index) => [item.key, swatch(ctx, index)]),
  );
}

/**
 * The names of `items` for a table: a service with its category in parentheses, a category as
 * itself. `all` is the full set, where the categories are.
 */
export function serviceLabels(
  items: readonly AnalyticsAxisItemViewDto[],
  all: SeriesSetViewDto,
  ctx: ChartContext,
): string[] {
  return items.map((item) => {
    const name = categoryLabel(item, ctx);
    if (item.parentKey === null) return name;
    const parent = all.axis.items.find((candidate) => candidate.key === item.parentKey);
    return parent ? `${name} (${categoryLabel(parent, ctx)})` : name;
  });
}

/** The category keys of the services, in the order of the categories in `set`. */
function categoryKeys(services: SeriesSetViewDto, set: SeriesSetViewDto): string[] {
  const used = new Set(services.axis.items.map((item) => item.parentKey ?? ''));
  const ordered = set.axis.items
    .filter((item) => item.parentKey === null && used.has(item.key))
    .map((item) => item.key);
  // A service whose category is not in the set still gets a bar.
  return [...ordered, ...[...used].filter((key) => !ordered.includes(key))];
}

/**
 * `bookingsPerService`: one horizontal bar per service, most booked on top. A bar takes its
 * category's swatch, and the legend lists the categories. Each category is one series, with a
 * value only on its own services, so a legend toggle hides a whole category.
 */
export function bookingsPerServiceOption(
  set: SeriesSetViewDto,
  ctx: ChartContext,
  colors: ReadonlyMap<string, string> = categorySwatches(set, ctx),
): ChartOption {
  const services = bookingsPerServiceSet(set);
  const labels = axisLabels(services, ctx);
  const titles = serviceLabels(services.axis.items, set, ctx);
  const bookings = seriesValues(services, 'bookings');
  const categories = categoryKeys(services, set).map((key, index) => {
    const item = set.axis.items.find((candidate) => candidate.key === key);
    return {
      key,
      name: item ? categoryLabel(item, ctx) : key,
      color: colors.get(key) ?? swatch(ctx, colors.size + index),
    };
  });
  const bookingsName = seriesName('bookings', ctx);

  return {
    ...baseOption(ctx),
    legend: chartLegend(categories.map(({ name, color }) => ({ name, color }))),
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'shadow' },
      formatter: (params: unknown) => {
        const index = tooltipIndex(params);
        const category = categories.find(
          (entry) => entry.key === services.axis.items[index]?.parentKey,
        );
        const shown = tooltipSeries(params).some((param) => param.seriesName === category?.name);
        const rows: TooltipRow[] =
          category && shown
            ? [
                {
                  name: bookingsName,
                  value: ctx.format.tooltip(bookings[index], 'Count'),
                  color: category.color,
                },
              ]
            : [];
        return tooltipHtml(titles[index] ?? '', rows);
      },
    },
    xAxis: valueAxis('Count', ctx, { minInterval: 1 }),
    // Inverse, so the first item, the largest, is on top.
    yAxis: { ...categoryAxis(labels), inverse: true },
    series: categories.map((category) => ({
      type: 'bar',
      name: category.name,
      // One stack, so the one bar of each row sits in the middle of the row.
      stack: 'service',
      data: services.axis.items.map((item, index) =>
        item.parentKey === category.key ? bookings[index] : null,
      ),
      color: category.color,
    })),
  };
}
