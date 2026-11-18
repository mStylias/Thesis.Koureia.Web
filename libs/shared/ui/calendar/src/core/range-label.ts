/**
 * The words in the toolbar that say where the calendar is. No Angular, no DOM.
 *
 * `Intl` builds every label, so the order of day, month and year and the
 * names themselves follow the locale, and a week that crosses a month or a
 * year repeats only the parts that differ.
 */
import {
  addDays,
  formatMonthHeading,
  parseIsoDate,
  type DateValue,
  type IsoWeekday,
} from '@ui/date-picker';
import type { TimeValue } from '@ui/time-picker';
import type { CalendarView } from '../calendar.types';
import { minutesOf, monthOf, startOfWeek, yearOf } from './date-math';

const REFERENCE = new Date(Date.UTC(2006, 10, 22));

function utcDate(value: DateValue): Date {
  const parts = parseIsoDate(value);
  return parts ? new Date(Date.UTC(parts.year, parts.month - 1, parts.day)) : REFERENCE;
}

function formatter(locale: string, options: Intl.DateTimeFormatOptions): Intl.DateTimeFormat {
  return new Intl.DateTimeFormat(locale, { calendar: 'gregory', timeZone: 'UTC', ...options });
}

/** `Δευτέρα 21 Σεπτεμβρίου 2026`. */
export function dayLabel(date: DateValue, locale: string): string {
  return formatter(locale, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(utcDate(date));
}

/**
 * `21 – 27 Σεπ 2026`, `28 Σεπ – 4 Οκτ 2026`, `28 Δεκ 2026 – 3 Ιαν 2027`.
 *
 * `formatRange` collapses the shared parts itself, which is the whole of why
 * it is used: hand-built variants per case are the bug this replaces.
 */
export function weekLabel(date: DateValue, locale: string, firstDayOfWeek: IsoWeekday): string {
  const start = startOfWeek(date, firstDayOfWeek);
  const end = addDays(start, 6);
  return formatter(locale, { day: 'numeric', month: 'short', year: 'numeric' }).formatRange(
    utcDate(start),
    utcDate(end),
  );
}

/** `Δευ 21`: the head of a day column, short enough for seven in a row. */
export function dayHeading(date: DateValue, locale: string): string {
  return formatter(locale, { weekday: 'short', day: 'numeric' }).format(utcDate(date));
}

/** `Σεπτέμβριος 2026`. */
export function monthLabel(date: DateValue, locale: string): string {
  return formatMonthHeading(monthOf(date), locale);
}

/** `2026`. */
export function yearLabel(date: DateValue, locale: string): string {
  return formatter(locale, { year: 'numeric' }).format(utcDate(`${yearOf(date).toString()}-01-01`));
}

/** The label for the view around `anchor`. Month and agenda both name the month. */
export function rangeLabel(
  anchor: DateValue,
  view: CalendarView,
  locale: string,
  firstDayOfWeek: IsoWeekday,
): string {
  switch (view) {
    case 'day':
      return dayLabel(anchor, locale);
    case 'week':
      return weekLabel(anchor, locale, firstDayOfWeek);
    case 'month':
    case 'agenda':
      return monthLabel(anchor, locale);
    case 'year':
      return yearLabel(anchor, locale);
  }
}

/**
 * `09:30`, in the locale's digits and separator.
 *
 * Always the 24-hour clock: the product writes times as `17:30` everywhere,
 * and a grid whose gutter switched to `5:30 μ.μ.` for one locale would say the
 * same hour two ways on one screen.
 */
export function timeLabel(time: TimeValue, locale: string): string {
  const total = minutesOf(time) ?? 0;
  return formatter(locale, { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(
    new Date(Date.UTC(2006, 10, 22, Math.floor(total / 60), total % 60)),
  );
}
