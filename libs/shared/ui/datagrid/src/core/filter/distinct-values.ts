/** Distinct-value collection and local interval bucketing. */
import { taggedValueKey } from '../grouping/group-nodes';
import { dayStart } from './date-filter';
import type { DistinctInterval, DistinctValuesRequest } from '../types/query.types';
import type {
  DistinctListEntry,
  DistinctValueOptions,
  LocalDistinctValue,
} from './distinct-values.types';

/** Distinct values with blanks first and the rest ordered by label. */
export function distinctValues<TRow>(
  rows: readonly TRow[],
  options: DistinctValueOptions<TRow>,
): readonly DistinctListEntry[] {
  const byKey = new Map<string, DistinctListEntry>();
  for (const row of rows) {
    const value = options.getValue(row);
    const blank = value == null || value === '';
    const key = taggedValueKey(blank ? null : value);
    const existing = byKey.get(key);
    if (existing === undefined) {
      byKey.set(key, {
        key,
        value: blank ? null : value,
        text: blank ? '' : options.format(value, row),
        count: 1,
        blank,
      });
    } else {
      existing.count += 1;
    }
  }
  return [...byKey.values()].sort((left, right) => {
    if (left.blank !== right.blank) {
      return left.blank ? -1 : 1;
    }
    return left.text.localeCompare(right.text);
  });
}

/** Collects one local source's exact values or requested buckets. */
export function collectDistinctValues<TRow>(
  rows: readonly TRow[],
  request: DistinctValuesRequest,
  getValue: (row: TRow, field: string) => unknown,
): readonly LocalDistinctValue<TRow>[] {
  const search = request.search?.trim().toLocaleLowerCase() ?? '';
  const byKey = new Map<
    string,
    { value: unknown; count: number; interval?: DistinctInterval; row: TRow }
  >();

  for (const row of rows) {
    const raw = getValue(row, request.field);
    if (search !== '' && !searchText(raw).toLocaleLowerCase().includes(search)) {
      continue;
    }
    const bucket = bucketValue(raw, request.interval);
    const key = taggedValueKey(bucket.value);
    const existing = byKey.get(key);
    if (existing === undefined) {
      byKey.set(key, { ...bucket, count: 1, row });
    } else {
      existing.count += 1;
    }
  }

  return [...byKey.values()]
    .sort((left, right) => compareValues(left.value, right.value))
    .map((entry) => ({
      value: entry.value,
      count: entry.count,
      row: entry.row,
      ...(entry.interval === undefined ? {} : { interval: entry.interval }),
    }));
}

function bucketValue(
  value: unknown,
  interval: DistinctInterval | undefined,
): { value: unknown; interval?: DistinctInterval } {
  if (interval == null) {
    return { value: value == null || value === '' ? null : value };
  }
  if (typeof interval === 'object') {
    const step = interval.step;
    if (
      typeof value !== 'number' ||
      !Number.isFinite(value) ||
      !Number.isFinite(step) ||
      step <= 0
    ) {
      return { value: value == null || value === '' ? null : value };
    }
    return { value: Math.floor(value / step) * step, interval };
  }
  const date = toDate(value);
  if (date == null) {
    return { value: value == null || value === '' ? null : value };
  }
  const start = new Date(date);
  switch (interval) {
    case 'year':
      start.setMonth(0, 1);
      start.setHours(0, 0, 0, 0);
      break;
    case 'quarter':
      start.setMonth(Math.floor(start.getMonth() / 3) * 3, 1);
      start.setHours(0, 0, 0, 0);
      break;
    case 'month':
      start.setDate(1);
      start.setHours(0, 0, 0, 0);
      break;
    case 'day':
      start.setHours(0, 0, 0, 0);
      break;
    case 'hour':
      start.setMinutes(0, 0, 0);
      break;
    case 'minute':
      start.setSeconds(0, 0);
      break;
  }
  return { value: start, interval };
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

function compareValues(left: unknown, right: unknown): number {
  if (left == null || left === '') {
    return right == null || right === '' ? 0 : -1;
  }
  if (right == null || right === '') {
    return 1;
  }
  if (left instanceof Date && right instanceof Date) {
    return left.getTime() - right.getTime();
  }
  if (typeof left === 'number' && typeof right === 'number') {
    return left - right;
  }
  return taggedValueKey(left).localeCompare(taggedValueKey(right));
}

function searchText(value: unknown): string {
  if (
    typeof value === 'string' ||
    typeof value === 'number' ||
    typeof value === 'bigint' ||
    typeof value === 'boolean'
  ) {
    return value.toString();
  }
  return value instanceof Date ? value.toISOString() : '';
}
