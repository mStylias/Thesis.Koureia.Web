/**
 * Relative date filters.
 *
 * A relative filter is stored as a descriptor and materialized into a
 * condition against the current instant on every query, refresh and state
 * restoration.
 */
import type {
  FilterConditionNode,
  RelativeDateFilter,
  RelativeDateUnit,
} from '../types/filter.types';

/**
 * Shifts a date by whole units. Calendar units (`day` and above) move the
 * wall-clock date so the result is stable across DST changes.
 */
export function shiftDate(date: Date, amount: number, unit: RelativeDateUnit): Date {
  const result = new Date(date.getTime());
  switch (unit) {
    case 'minute':
      result.setMinutes(result.getMinutes() + amount);
      return result;
    case 'hour':
      result.setHours(result.getHours() + amount);
      return result;
    case 'day':
      result.setDate(result.getDate() + amount);
      return result;
    case 'week':
      result.setDate(result.getDate() + amount * 7);
      return result;
    case 'month':
      result.setMonth(result.getMonth() + amount);
      return result;
    case 'year':
      result.setFullYear(result.getFullYear() + amount);
      return result;
  }
}

/** The wall-clock date and time of `timeZone` at `instant`, as UTC fields. */
function zonedParts(instant: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: 'numeric',
    minute: 'numeric',
    second: 'numeric',
    hourCycle: 'h23',
  }).formatToParts(instant);
  const part = (type: Intl.DateTimeFormatPartTypes): number =>
    Number(parts.find((entry) => entry.type === type)?.value ?? 0);
  return Date.UTC(
    part('year'),
    part('month') - 1,
    part('day'),
    part('hour'),
    part('minute'),
    part('second'),
  );
}

/**
 * The instant a day starts in `timeZone`, for the day `instant` falls on there, moved by
 * `days`. Without a zone it is the host environment's midnight.
 */
export function startOfZonedDay(instant: Date, days: number, timeZone?: string): Date {
  if (timeZone == null) {
    const local = new Date(instant.getFullYear(), instant.getMonth(), instant.getDate());
    local.setDate(local.getDate() + days);
    return local;
  }
  const wall = new Date(zonedParts(instant, timeZone));
  const target = Date.UTC(wall.getUTCFullYear(), wall.getUTCMonth(), wall.getUTCDate() + days);
  // The zone's offset at the target, read twice: the first guess can sit on the far side of
  // a DST change, and the second read corrects it.
  let guess = target;
  for (let pass = 0; pass < 2; pass += 1) {
    const offset = zonedParts(new Date(guess), timeZone) - guess;
    guess = target - offset;
  }
  return new Date(guess);
}

/** The start of the unit period `amount` units from today, in `timeZone`. */
function periodStart(now: Date, amount: number, unit: RelativeDateUnit, timeZone?: string): Date {
  if (unit === 'day') {
    return startOfZonedDay(now, amount, timeZone);
  }
  if (unit === 'week') {
    return startOfZonedDay(now, amount * 7, timeZone);
  }
  return shiftDate(startOfZonedDay(now, 0, timeZone), amount, unit);
}

/**
 * Materializes the descriptor.
 *
 * `'last'` is a `between` over `[past, now]` and `'next'` over `[now, future]`. `'from'` is a
 * `ge` on the period's start and `'before'` an `lt`. `'on'` is a `between` that ends one
 * millisecond before the next period, which is how the filter row widens a picked day too.
 */
export function resolveRelativeDateFilter(
  field: string,
  filter: RelativeDateFilter,
  now: Date = new Date(),
  timeZone?: string,
): FilterConditionNode {
  switch (filter.direction) {
    case 'last':
    case 'next': {
      const boundary = shiftDate(
        now,
        filter.direction === 'last' ? -filter.amount : filter.amount,
        filter.unit,
      );
      const range = filter.direction === 'last' ? [boundary, now] : [now, boundary];
      return { field, op: 'between', value: range };
    }
    case 'from':
      return { field, op: 'ge', value: periodStart(now, filter.amount, filter.unit, timeZone) };
    case 'before':
      return { field, op: 'lt', value: periodStart(now, filter.amount, filter.unit, timeZone) };
    case 'on': {
      const start = periodStart(now, filter.amount, filter.unit, timeZone);
      const end = periodStart(now, filter.amount + 1, filter.unit, timeZone);
      return { field, op: 'between', value: [start, new Date(end.getTime() - 1)] };
    }
  }
}
