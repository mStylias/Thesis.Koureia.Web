/** Year, month, and day buckets for a date header filter. */
import { where } from './filter-node';
import { dayStart } from './date-filter';
import type { FilterNode } from '../types/filter.types';
import type { DistinctValue } from '../types/query.types';
import type { DateBucket, DateBucketOptions } from './date-buckets.types';

/** Builds a Year → Month → Day hierarchy from exact days or an inclusive range. */
export function buildDateBuckets(
  values: readonly DistinctValue[],
  options: DateBucketOptions = {},
): readonly DateBucket[] {
  const days =
    options.generatedRange == null
      ? exactDays(values)
      : generatedDays(options.generatedRange.min, options.generatedRange.max);
  const monthFormat = new Intl.DateTimeFormat(options.locale, { month: 'long' });
  const dayFormat = new Intl.DateTimeFormat(options.locale, { day: 'numeric' });
  const years = new Map<number, Map<number, Map<number, number | null>>>();

  for (const entry of days) {
    const year = entry.date.getFullYear();
    const month = entry.date.getMonth();
    const day = entry.date.getDate();
    const months = years.get(year) ?? new Map<number, Map<number, number | null>>();
    const monthDays = months.get(month) ?? new Map<number, number | null>();
    const previous = monthDays.get(day);
    monthDays.set(
      day,
      previous == null || entry.count == null ? entry.count : previous + entry.count,
    );
    months.set(month, monthDays);
    years.set(year, months);
  }

  return [...years.entries()].map(([year, months]) => {
    const monthNodes = [...months.entries()].map(([month, monthDays]) => {
      const dayNodes = [...monthDays.entries()].map(([day, count]) => {
        const start = new Date(year, month, day, 0, 0, 0, 0);
        return {
          key: dayKey(year, month, day),
          label: dayFormat.format(start),
          level: 'day' as const,
          start,
          end: new Date(year, month, day, 23, 59, 59, 999),
          count,
          children: [],
        };
      });
      const start = new Date(year, month, 1, 0, 0, 0, 0);
      return {
        key: monthKey(year, month),
        label: monthFormat.format(start),
        level: 'month' as const,
        start,
        end: new Date(year, month + 1, 0, 23, 59, 59, 999),
        count: summedCount(dayNodes),
        children: dayNodes,
      };
    });
    return {
      key: `y:${year.toString()}`,
      label: year.toString(),
      level: 'year' as const,
      start: new Date(year, 0, 1, 0, 0, 0, 0),
      end: new Date(year, 11, 31, 23, 59, 59, 999),
      count: summedCount(monthNodes),
      children: monthNodes,
    };
  });
}

/** Compiles one tree period to the inclusive range represented by the node. */
export function dateBucketFilter(field: string, bucket: DateBucket): FilterNode {
  return where(field, 'between', [bucket.start, bucket.end]);
}

function exactDays(
  values: readonly DistinctValue[],
): readonly { date: Date; count: number | null }[] {
  const byDay = new Map<string, { date: Date; count: number | null }>();
  for (const value of values) {
    const date = toDate(value.value);
    if (date == null) {
      continue;
    }
    const start = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    const key = dayKey(start.getFullYear(), start.getMonth(), start.getDate());
    const count = value.count ?? null;
    const previous = byDay.get(key);
    byDay.set(key, {
      date: start,
      count: previous == null ? count : mergeCounts(previous.count, count),
    });
  }
  return [...byDay.values()].sort((left, right) => left.date.getTime() - right.date.getTime());
}

function generatedDays(min: unknown, max: unknown): readonly { date: Date; count: null }[] {
  const first = toDate(min);
  const last = toDate(max);
  if (first == null || last == null || first.getTime() > last.getTime()) {
    return [];
  }
  const cursor = new Date(first.getFullYear(), first.getMonth(), first.getDate());
  const end = new Date(last.getFullYear(), last.getMonth(), last.getDate()).getTime();
  const days: { date: Date; count: null }[] = [];
  while (cursor.getTime() <= end) {
    days.push({ date: new Date(cursor), count: null });
    cursor.setDate(cursor.getDate() + 1);
  }
  return days;
}

function toDate(value: unknown): Date | null {
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return dayStart(value);
  }
  if (typeof value !== 'string' && typeof value !== 'number') {
    return null;
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function summedCount(children: readonly { count: number | null }[]): number | null {
  return children.every((child) => child.count != null)
    ? children.reduce((total, child) => total + (child.count ?? 0), 0)
    : null;
}

function mergeCounts(left: number | null, right: number | null): number | null {
  return left == null || right == null ? null : left + right;
}

function monthKey(year: number, month: number): string {
  return `m:${year.toString()}-${(month + 1).toString().padStart(2, '0')}`;
}

function dayKey(year: number, month: number, day: number): string {
  return `d:${year.toString()}-${(month + 1).toString().padStart(2, '0')}-${day
    .toString()
    .padStart(2, '0')}`;
}
