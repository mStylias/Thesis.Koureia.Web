import type {
  AnalyticsAxisItemViewDto,
  AnalyticsAxisViewDto,
  AnalyticsGranularity,
  AnalyticsPeriodViewDto,
  AnalyticsSeriesViewDto,
  SeriesSetViewDto,
} from '@api/analytics';
import { isAppointmentStatus, statusLabelKey } from '@features/management-shared-appointments';

import type { ChartContext, TimeBucket } from './chart-options.types';

/** The series keys `managementDashboard.series` names. Any other key shows as itself. */
const SERIES_KEYS: readonly string[] = [
  'value',
  'revenue',
  'completedAppointments',
  'appointments',
  'bookedMinutes',
  'availableMinutes',
  'utilization',
  'averageRating',
  'reviews',
  'new',
  'returning',
  'cancellationRate',
  'noShowRate',
  'visits',
  'bookings',
  'spend',
  'online',
  'staff',
];

/** The category keys `managementDashboard.axisKeys` names, for items with no server label. */
const AXIS_KEYS: readonly string[] = ['online', 'staff', 'customer', 'shop', 'uncategorized'];

const DAY_MS = 86_400_000;

/** The series with this key, or `undefined`. */
export function seriesByKey(
  set: SeriesSetViewDto,
  key: string,
): AnalyticsSeriesViewDto | undefined {
  return set.series.find((series) => series.key === key);
}

/** A series' values, one per axis item. A missing series or value is `null`. */
export function seriesValues(set: SeriesSetViewDto, key: string): (number | null)[] {
  const values = seriesByKey(set, key)?.values ?? [];
  return set.axis.items.map((_, index) => values[index] ?? null);
}

/** Whether a value draws anything: not `null` and not `0`. */
export function hasValue(value: number | null | undefined): value is number {
  return value !== null && value !== undefined && value !== 0;
}

/**
 * Whether the value at `index` has `null` or nothing on both sides. A line draws no segment for
 * such a value, so only a marker can show it.
 */
export function isIsolatedValue(values: readonly (number | null)[], index: number): boolean {
  return (
    (values[index] ?? null) !== null &&
    (values[index - 1] ?? null) === null &&
    (values[index + 1] ?? null) === null
  );
}

/** Whether any value of a line has `null` or nothing on both sides. See {@link isIsolatedValue}. */
export function hasIsolatedValue(values: readonly (number | null)[]): boolean {
  return values.some((_, index) => isIsolatedValue(values, index));
}

/**
 * A set with nothing to draw: no axis items, or every value `0` or `null` in the series of
 * `keys` (every series when left out). The card shows its empty state instead of a frame.
 */
export function isEmptySeriesSet(
  set: SeriesSetViewDto | null | undefined,
  keys?: readonly string[],
): boolean {
  if (!set || set.axis.items.length === 0) return true;
  const series = keys ? set.series.filter((item) => keys.includes(item.key)) : set.series;
  return !series.some((item) => item.values.some(hasValue));
}

/** Item indexes ordered by a series, largest first. `null` sorts last, ties keep their order. */
export function indexesByValue(values: readonly (number | null)[]): number[] {
  return values
    .map((value, index) => ({ value, index }))
    .sort((a, b) => (b.value ?? -Infinity) - (a.value ?? -Infinity) || a.index - b.index)
    .map((entry) => entry.index);
}

/** The set cut to some of its items, in the order given. Every series follows. */
export function pickItems(set: SeriesSetViewDto, indexes: readonly number[]): SeriesSetViewDto {
  return {
    axis: { ...set.axis, items: indexes.map((index) => set.axis.items[index]) },
    series: set.series.map((series) => ({
      ...series,
      values: indexes.map((index) => series.values[index] ?? null),
    })),
  };
}

/** Only the items with no parent: the categories of a service set. */
export function topLevelSet(set: SeriesSetViewDto): SeriesSetViewDto {
  return pickItems(
    set,
    set.axis.items.flatMap((item, index) => (item.parentKey === null ? [index] : [])),
  );
}

/** The comparison series' name: "Previous period" or "Last year", from `period.comparison`. */
export function comparisonName(ctx: ChartContext): string {
  return ctx.t(`managementDashboard.comparison.${ctx.period.comparison}`);
}

/** A series key as its legend and tooltip name. Statuses take the appointments page's labels. */
export function seriesName(key: string, ctx: ChartContext): string {
  if (isAppointmentStatus(key)) return ctx.t(statusLabelKey(key));
  if (key === 'previous') return comparisonName(ctx);
  if (SERIES_KEYS.includes(key)) return ctx.t(`managementDashboard.series.${key}`);
  return key;
}

/** A category item's name: the server's label, a translated key, or the key itself. */
export function categoryLabel(item: AnalyticsAxisItemViewDto, ctx: ChartContext): string {
  if (item.label !== null) return item.label;
  if (isAppointmentStatus(item.key)) return ctx.t(statusLabelKey(item.key));
  if (AXIS_KEYS.includes(item.key)) return ctx.t(`managementDashboard.axisKeys.${item.key}`);
  return item.key;
}

/** One axis item's label, by the axis kind. */
export function axisItemLabel(
  item: AnalyticsAxisItemViewDto,
  axis: AnalyticsAxisViewDto,
  ctx: ChartContext,
): string {
  switch (axis.kind) {
    case 'Time':
      return ctx.format.bucket(item, axis.granularity ?? ctx.period.granularity);
    case 'Range':
      return ctx.format.range(item);
    default:
      return categoryLabel(item, ctx);
  }
}

/** The labels of a set's axis, one per item. */
export function axisLabels(set: SeriesSetViewDto, ctx: ChartContext): string[] {
  return set.axis.items.map((item) => axisItemLabel(item, set.axis, ctx));
}

function toDay(day: string): number {
  return Date.parse(`${day}T00:00:00Z`) / DAY_MS;
}

function fromDay(day: number): string {
  return new Date(day * DAY_MS).toISOString().slice(0, 10);
}

/**
 * The buckets of a range, as the API builds them: weeks start on Monday, months on the 1st, and
 * the first and last bucket are cut to the range.
 */
export function timeBuckets(
  from: string,
  to: string,
  granularity: AnalyticsGranularity,
): TimeBucket[] {
  const first = toDay(from);
  const last = toDay(to);
  if (!Number.isFinite(first) || !Number.isFinite(last)) return [];
  const buckets: TimeBucket[] = [];
  for (let start = first; start <= last;) {
    const date = new Date(start * DAY_MS);
    let end = start;
    if (granularity === 'Week') {
      // getUTCDay: Sunday is 0. A week ends on Sunday.
      end = start + ((7 - date.getUTCDay()) % 7);
    } else if (granularity === 'Month') {
      end = Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0) / DAY_MS;
    }
    end = Math.min(end, last);
    buckets.push({ fromDate: fromDay(start), toDate: fromDay(end) });
    start = end + 1;
  }
  return buckets;
}

/**
 * The comparison range's buckets. The API lines the `previous` series up with the axis by
 * position, so bucket `i` here holds the dates of value `i`. It can be shorter than the axis.
 */
export function comparisonBuckets(period: AnalyticsPeriodViewDto): TimeBucket[] {
  return timeBuckets(period.comparisonFrom, period.comparisonTo, period.granularity);
}
