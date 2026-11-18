/**
 * Wall-clock day boundaries for date filtering.
 *
 * A date editor collects a day, not an instant, so "equals 5 January" has to
 * become the whole of that day or a `datetime` column matches only the rows
 * stored at exactly midnight. The boundaries are local, which is the
 * host-declared wall-clock semantics §7.4 asks for.
 */

const ISO_DAY = /^(\d{4})-(\d{2})-(\d{2})$/;

/** Parses a `YYYY-MM-DD` string or a `Date` into year, month and day. */
function partsOf(value: unknown): [number, number, number] | null {
  if (value instanceof Date) {
    return Number.isNaN(value.getTime())
      ? null
      : [value.getFullYear(), value.getMonth(), value.getDate()];
  }
  if (typeof value !== 'string') {
    return null;
  }
  const match = ISO_DAY.exec(value);
  return match == null ? null : [Number(match[1]), Number(match[2]) - 1, Number(match[3])];
}

/** Local midnight opening the day a value names, or `null`. */
export function dayStart(value: unknown): Date | null {
  const parts = partsOf(value);
  return parts == null ? null : new Date(parts[0], parts[1], parts[2], 0, 0, 0, 0);
}

/** The last millisecond of the day a value names, or `null`. */
export function dayEnd(value: unknown): Date | null {
  const parts = partsOf(value);
  return parts == null ? null : new Date(parts[0], parts[1], parts[2], 23, 59, 59, 999);
}

/**
 * The `YYYY-MM-DD` form a date editor binds, or `''` for anything that names
 * no day. Built from the local parts rather than from `toISOString`, which
 * shifts to UTC and can move the date by one.
 */
export function toDateValue(value: unknown): string {
  const parts = partsOf(value);
  if (parts == null) {
    return '';
  }
  const [year, month, day] = parts;
  return `${year.toString().padStart(4, '0')}-${(month + 1).toString().padStart(2, '0')}-${day
    .toString()
    .padStart(2, '0')}`;
}
