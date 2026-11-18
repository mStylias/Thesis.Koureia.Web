/**
 * The calendar's date arithmetic. No Angular, no DOM.
 *
 * Every date is a canonical `YYYY-MM-DD` and every time a canonical `HH:mm`,
 * both local to the host's time zone. Arithmetic runs on UTC `Date`s built
 * from those parts, the same way `@ui/date-picker` does, so a daylight-saving
 * shift in the browser's own zone can never move a calendar day.
 */
import {
  addDays,
  addMonths,
  dateInMonth,
  parseIsoDate,
  type DateValue,
  type IsoWeekday,
  type MonthValue,
} from '@ui/date-picker';
import { formatTime, parseTime, type TimeValue } from '@ui/time-picker';
import type { CalendarRange, CalendarView } from '../calendar.types';
import type { ZoneClock } from './date-math.types';

export const MINUTES_PER_DAY = 24 * 60;

/** ISO weekday of a date: Monday is 1, Sunday is 7. */
export function isoWeekdayOf(date: DateValue): IsoWeekday {
  const parts = parseIsoDate(date);
  if (!parts) {
    return 1;
  }
  const day = new Date(Date.UTC(parts.year, parts.month - 1, parts.day)).getUTCDay();
  return (day === 0 ? 7 : day) as IsoWeekday;
}

/** The first day of the week holding `date`. */
export function startOfWeek(date: DateValue, firstDayOfWeek: IsoWeekday): DateValue {
  const offset = (isoWeekdayOf(date) - firstDayOfWeek + 7) % 7;
  return addDays(date, -offset);
}

/** The seven days of the week holding `date`, in order. */
export function weekDays(date: DateValue, firstDayOfWeek: IsoWeekday): DateValue[] {
  const start = startOfWeek(date, firstDayOfWeek);
  return Array.from({ length: 7 }, (_, index) => addDays(start, index));
}

export function monthOf(date: DateValue): MonthValue {
  return date.slice(0, 7);
}

export function yearOf(date: DateValue): number {
  return Number(date.slice(0, 4));
}

/** The first of the month after `month`. */
function nextMonthStart(month: MonthValue): DateValue {
  return `${addMonths(month, 1)}-01`;
}

/**
 * Every day a month view draws: whole weeks from the one holding the 1st to
 * the one holding the last day. Four to six rows, never a padded sixth.
 */
export function monthGridDays(month: MonthValue, firstDayOfWeek: IsoWeekday): DateValue[] {
  const first = `${month}-01`;
  const start = startOfWeek(first, firstDayOfWeek);
  const lastOfMonth = addDays(nextMonthStart(month), -1);
  const end = addDays(startOfWeek(lastOfMonth, firstDayOfWeek), 7);
  return datesBetween(start, end);
}

/** The twelve months of a year, `YYYY-MM`. */
export function yearMonths(year: number): MonthValue[] {
  return Array.from(
    { length: 12 },
    (_, index) => `${year.toString()}-${(index + 1).toString().padStart(2, '0')}`,
  );
}

/** Every date from `start` up to but not including `end`. Empty when `end` is not after `start`. */
export function datesBetween(start: DateValue, end: DateValue): DateValue[] {
  const dates: DateValue[] = [];
  for (let date = start; date < end; date = addDays(date, 1)) {
    dates.push(date);
  }
  return dates;
}

/**
 * The dates a view draws around `anchor`.
 *
 * Month is the whole grid, leading and trailing days included, because those
 * cells show their events too. Agenda is the month proper, since it lists
 * rather than draws a grid.
 */
export function viewRange(
  anchor: DateValue,
  view: CalendarView,
  firstDayOfWeek: IsoWeekday,
): CalendarRange {
  switch (view) {
    case 'day':
      return { start: anchor, end: addDays(anchor, 1), view };
    case 'week': {
      const start = startOfWeek(anchor, firstDayOfWeek);
      return { start, end: addDays(start, 7), view };
    }
    case 'month': {
      const days = monthGridDays(monthOf(anchor), firstDayOfWeek);
      const first = days.at(0) ?? anchor;
      const last = days.at(-1) ?? anchor;
      return { start: first, end: addDays(last, 1), view };
    }
    case 'agenda': {
      const month = monthOf(anchor);
      return { start: `${month}-01`, end: nextMonthStart(month), view };
    }
    case 'year': {
      const year = yearOf(anchor);
      return { start: `${year.toString()}-01-01`, end: `${(year + 1).toString()}-01-01`, view };
    }
  }
}

/**
 * The anchor one step before or after, in the unit of the view.
 *
 * A month or a year step keeps the day of the month where the target month
 * has it and clamps otherwise, so 31 January steps to 28 February and back
 * to 28 January: a step never lands outside the month it names, and a day
 * the user chose survives a round trip when it can.
 */
export function shiftAnchor(anchor: DateValue, view: CalendarView, direction: 1 | -1): DateValue {
  const parts = parseIsoDate(anchor);
  if (!parts) {
    return anchor;
  }
  switch (view) {
    case 'day':
      return addDays(anchor, direction);
    case 'week':
      return addDays(anchor, 7 * direction);
    case 'month':
    case 'agenda':
      return dateInMonth(addMonths(monthOf(anchor), direction), parts.day);
    case 'year':
      return dateInMonth(addMonths(monthOf(anchor), 12 * direction), parts.day);
  }
}

/** Minutes since midnight, or `null` for text that is not a time. */
export function minutesOf(time: TimeValue): number | null {
  return parseTime(time) ?? null;
}

/** `HH:mm` for minutes since midnight. Wraps past the day, like the time picker. */
export function timeOf(minutes: number): TimeValue {
  return formatTime(minutes);
}

/**
 * The minutes an event occupies inside its day, as a half-open interval.
 *
 * An end at or before the start reads as the end of the day: a single-day
 * vocabulary has no other way to say "runs until close", and a zero-length
 * interval would draw nothing.
 */
export function eventMinutes(
  start: TimeValue,
  end: TimeValue,
): { readonly start: number; readonly end: number } | null {
  const from = minutesOf(start);
  if (from === null) {
    return null;
  }
  const to = minutesOf(end);
  return { start: from, end: to === null || to <= from ? MINUTES_PER_DAY : to };
}

/** `minutes` floored to the scale, held inside the day. */
export function snapMinutes(minutes: number, scale: number): number {
  const step = Math.max(1, Math.floor(scale));
  const snapped = Math.floor(minutes / step) * step;
  return Math.min(Math.max(snapped, 0), MINUTES_PER_DAY - step);
}

/**
 * The wall clock of `timeZone` at `instant`.
 *
 * `Intl` does the conversion, which is the only place the calendar ever meets
 * an instant: everything else it holds is already local. `en-CA` is the locale
 * whose short date is ISO, and `hourCycle: 'h23'` keeps midnight at `00`.
 */
export function zoneClock(timeZone: string, instant: Date = new Date()): ZoneClock {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(instant);
  const part = (type: Intl.DateTimeFormatPartTypes): string =>
    parts.find((entry) => entry.type === type)?.value ?? '00';
  const date = `${part('year')}-${part('month')}-${part('day')}`;
  const time = `${part('hour')}:${part('minute')}`;
  return { date, time, minutes: minutesOf(time) ?? 0 };
}
