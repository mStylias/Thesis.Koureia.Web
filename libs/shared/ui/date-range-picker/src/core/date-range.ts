import {
  addDays,
  addMonths,
  createMonthGrid,
  dateInMonth,
  type DateLocaleInfo,
  type DateValue,
  formatMonthHeading,
  isDateAllowed,
  type MonthValue,
  parseIsoDate,
} from '@ui/date-picker';

import type {
  DateRangeConstraints,
  DateRangeDates,
  DateRangeErrorKind,
  DateRangePreset,
  DateRangeValue,
  RangeCalendarMonth,
} from '../date-range-picker.types';

const DAY_MS = 86_400_000;

/** No range. */
export const EMPTY_DATE_RANGE: DateRangeValue = { preset: null, from: '', to: '' };

function dayNumber(value: DateValue): number | undefined {
  const parts = parseIsoDate(value);
  return parts ? Date.UTC(parts.year, parts.month - 1, parts.day) / DAY_MS : undefined;
}

/** ISO weekday of a canonical date: Monday is 1 and Sunday is 7. */
export function isoWeekdayOf(value: DateValue): number {
  const day = dayNumber(value);
  // Day 0 of the epoch, 1 January 1970, was a Thursday.
  return day === undefined ? 1 : ((((day + 3) % 7) + 7) % 7) + 1;
}

/** A date for reading, such as "1 Σεπ 2026". Empty for a date that is not canonical. */
export function formatRangeDate(value: DateValue, locale: string): string {
  const day = dayNumber(value);
  if (day === undefined) return '';
  try {
    return new Intl.DateTimeFormat(locale, {
      calendar: 'gregory',
      timeZone: 'UTC',
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    }).format(new Date(day * DAY_MS));
  } catch {
    return value;
  }
}

/** A month's short name, such as "Σεπ", for the month grid. */
export function formatMonthName(month: MonthValue, locale: string): string {
  const day = dayNumber(`${month}-01`);
  if (day === undefined) return month;
  try {
    return new Intl.DateTimeFormat(locale, {
      calendar: 'gregory',
      timeZone: 'UTC',
      month: 'short',
    }).format(new Date(day * DAY_MS));
  } catch {
    return month;
  }
}

/** Days from `from` to `to`, both counted. 0 when either date is not canonical or `to` is earlier. */
export function countRangeDays(from: DateValue, to: DateValue): number {
  const start = dayNumber(from);
  const end = dayNumber(to);
  return start === undefined || end === undefined || end < start ? 0 : end - start + 1;
}

/** The two dates in calendar order. */
export function orderDates(first: DateValue, second: DateValue): DateRangeDates {
  return first <= second ? { from: first, to: second } : { from: second, to: first };
}

/** The first rule a canonical range breaks, or `undefined` when it keeps them all. */
export function checkDateRange(
  range: DateRangeDates,
  constraints: DateRangeConstraints,
): DateRangeErrorKind | undefined {
  if (!parseIsoDate(range.from) || !parseIsoDate(range.to)) return 'dateFormat';
  if (!isDateAllowed(range.from, constraints) || !isDateAllowed(range.to, constraints)) {
    return 'dateUnavailable';
  }
  if (range.to < range.from) return 'rangeOrder';
  const maxDays = safeMaxDays(constraints.maxDays);
  if (maxDays !== undefined && countRangeDays(range.from, range.to) > maxDays) {
    return 'rangeTooLong';
  }
  return undefined;
}

/** A usable day limit: a whole number of at least 1, or none. */
export function safeMaxDays(value: number | undefined): number | undefined {
  return value !== undefined && Number.isFinite(value) && value >= 1
    ? Math.floor(value)
    : undefined;
}

/**
 * Whether `date` can end a range that starts at `anchor`. `maxDays` counts both ends, in either
 * direction, because a second click before the first one is ordered, not refused.
 */
export function isWithinMaxDays(
  anchor: DateValue,
  date: DateValue,
  maxDays: number | undefined,
): boolean {
  if (maxDays === undefined) return true;
  const ordered = orderDates(anchor, date);
  return countRangeDays(ordered.from, ordered.to) <= maxDays;
}

function lastDays(id: string, days: number): DateRangePreset {
  return { id, resolve: (today) => ({ from: addDays(today, 1 - days), to: today }) };
}

/** The built-in presets. Each ends today. Their labels ship in the picker's dictionary. */
export const DATE_RANGE_PRESETS: readonly DateRangePreset[] = [
  lastDays('last7', 7),
  lastDays('last30', 30),
  lastDays('last90', 90),
  { id: 'thisMonth', resolve: (today) => ({ from: `${today.slice(0, 7)}-01`, to: today }) },
  {
    id: 'lastMonth',
    resolve: (today) => {
      const firstOfThisMonth = `${today.slice(0, 7)}-01`;
      return { from: `${addMonths(today.slice(0, 7), -1)}-01`, to: addDays(firstOfThisMonth, -1) };
    },
  },
  { id: 'thisYear', resolve: (today) => ({ from: `${today.slice(0, 4)}-01-01`, to: today }) },
  {
    id: 'last12Months',
    resolve: (today) => {
      // `dateInMonth` turns 29 February into the 28th of a common year.
      const yearAgo = dateInMonth(addMonths(today.slice(0, 7), -12), parseIsoDate(today)?.day ?? 1);
      return { from: addDays(yearAgo, 1), to: today };
    },
  },
];

/** The value `preset` gives on `today`, or `undefined` for an unknown id. */
export function resolveDateRangePreset(
  presets: readonly DateRangePreset[],
  id: string,
  today: DateValue,
): DateRangeValue | undefined {
  const preset = presets.find((candidate) => candidate.id === id);
  return preset ? { preset: preset.id, ...preset.resolve(today) } : undefined;
}

/**
 * One month of the panel. `anchor` is a first click still waiting for its second: the days it
 * cannot reach within `maxDays` are disabled, and the range previews up to `preview`.
 */
export function createRangeMonth(options: {
  readonly month: MonthValue;
  readonly headingId: string;
  readonly localeInfo: DateLocaleInfo;
  readonly constraints: DateRangeConstraints;
  readonly today: DateValue;
  readonly range: DateRangeDates;
  readonly anchor: DateValue;
  readonly preview: DateValue;
}): RangeCalendarMonth {
  const { month, localeInfo, constraints, today, anchor } = options;
  const maxDays = safeMaxDays(constraints.maxDays);
  const shown =
    anchor && options.preview
      ? orderDates(anchor, options.preview)
      : anchor
        ? { from: anchor, to: anchor }
        : options.range;
  const weeks = createMonthGrid(month, localeInfo, constraints, today).map((week) =>
    week.map((day) => {
      const visible = shown.from !== '' && shown.to !== '' && day.inCurrentMonth;
      return {
        ...day,
        disabled: day.disabled || (anchor !== '' && !isWithinMaxDays(anchor, day.date, maxDays)),
        rangeStart: visible && day.date === shown.from,
        rangeEnd: visible && day.date === shown.to,
        inRange: visible && day.date >= shown.from && day.date <= shown.to,
      };
    }),
  );
  return {
    month,
    heading: formatMonthHeading(month, localeInfo.locale),
    headingId: options.headingId,
    weeks,
  };
}
