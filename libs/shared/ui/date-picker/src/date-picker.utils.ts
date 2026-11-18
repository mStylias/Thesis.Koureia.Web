import {
  AvailabilityLevel,
  CalendarDay,
  CalendarWeekday,
  DateConstraints,
  DateEntryState,
  DateLocaleInfo,
  DateValue,
  DayAvailability,
  IsoWeekday,
  MonthValue,
} from './date-picker.types';

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;
const ISO_MONTH = /^(\d{4})-(\d{2})$/;
const REFERENCE_DATE = new Date(Date.UTC(2006, 10, 22));
const MONDAY_REFERENCE = new Date(Date.UTC(2021, 7, 2));

type DatePart = 'day' | 'month' | 'year';

interface DateParts {
  readonly year: number;
  readonly month: number;
  readonly day: number;
}

interface WeekInfoLocale {
  getWeekInfo?: () => { readonly firstDay: number };
  weekInfo?: { readonly firstDay: number };
}

function formatter(locale: string, options: Intl.DateTimeFormatOptions): Intl.DateTimeFormat {
  return new Intl.DateTimeFormat(locale, {
    calendar: 'gregory',
    timeZone: 'UTC',
    ...options,
  });
}

function toUtcDate(value: DateValue): Date | undefined {
  const parts = parseIsoDate(value);
  return parts ? new Date(Date.UTC(parts.year, parts.month - 1, parts.day)) : undefined;
}

function fromUtcDate(value: Date): DateValue {
  const year = value.getUTCFullYear();
  const month = String(value.getUTCMonth() + 1).padStart(2, '0');
  const day = String(value.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function localeOrder(locale: string): readonly DatePart[] {
  return formatter(locale, {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
    .formatToParts(REFERENCE_DATE)
    .map((part) => part.type)
    .filter((part): part is DatePart => part === 'day' || part === 'month' || part === 'year');
}

function normalizeDigits(value: string, locale: string): string {
  const number = new Intl.NumberFormat(locale, {
    useGrouping: false,
  });
  const digits = new Map<string, string>();
  for (let index = 0; index <= 9; index += 1) {
    digits.set(number.format(index), String(index));
  }
  return Array.from(value)
    .map((character) => digits.get(character) ?? character)
    .join('');
}

function dateFromParts(parts: DateParts): DateValue | undefined {
  if (parts.year < 1 || parts.month < 1 || parts.month > 12 || parts.day < 1) {
    return undefined;
  }
  const candidate = new Date(Date.UTC(parts.year, parts.month - 1, parts.day));
  if (
    candidate.getUTCFullYear() !== parts.year ||
    candidate.getUTCMonth() !== parts.month - 1 ||
    candidate.getUTCDate() !== parts.day
  ) {
    return undefined;
  }
  return fromUtcDate(candidate);
}

function isoWeekday(value: Date): IsoWeekday {
  return (value.getUTCDay() || 7) as IsoWeekday;
}

function normalizedLocale(locale: string): string {
  try {
    return Intl.getCanonicalLocales(locale)[0] ?? 'el-GR';
  } catch {
    return 'el-GR';
  }
}

function localeFirstDay(locale: string): IsoWeekday {
  try {
    const intlLocale = new Intl.Locale(locale) as unknown as WeekInfoLocale;
    const firstDay = intlLocale.getWeekInfo?.().firstDay ?? intlLocale.weekInfo?.firstDay;
    if (firstDay && firstDay >= 1 && firstDay <= 7) {
      return firstDay as IsoWeekday;
    }
  } catch {
    // The explicit Monday fallback matches the app’s Greek-first default.
  }
  return 1;
}

/** Returns valid Gregorian parts for a canonical date. */
export function parseIsoDate(value: DateValue): DateParts | undefined {
  const match = ISO_DATE.exec(value);
  if (!match) {
    return undefined;
  }
  const parts = {
    year: Number(match[1]),
    month: Number(match[2]),
    day: Number(match[3]),
  };
  return dateFromParts(parts) ? parts : undefined;
}

export function isCanonicalDate(value: DateValue): boolean {
  return !!parseIsoDate(value);
}

export function dateToMonth(value: DateValue): MonthValue | undefined {
  return parseIsoDate(value) ? value.slice(0, 7) : undefined;
}

export function isCanonicalMonth(value: MonthValue): boolean {
  const match = ISO_MONTH.exec(value);
  if (!match) {
    return false;
  }
  const month = Number(match[2]);
  return month >= 1 && month <= 12;
}

export function addDays(value: DateValue, amount: number): DateValue {
  const date = toUtcDate(value);
  if (!date) {
    return value;
  }
  date.setUTCDate(date.getUTCDate() + amount);
  return fromUtcDate(date);
}

export function addMonths(value: MonthValue, amount: number): MonthValue {
  const match = ISO_MONTH.exec(value);
  if (!match) {
    return value;
  }
  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1 + amount, 1));
  return fromUtcDate(date).slice(0, 7);
}

export function dateInMonth(month: MonthValue, preferredDay: number): DateValue {
  const firstOfNextMonth = `${addMonths(month, 1)}-01`;
  const lastDay = parseIsoDate(addDays(firstOfNextMonth, -1))?.day ?? 1;
  return `${month}-${String(Math.min(Math.max(preferredDay, 1), lastDay)).padStart(2, '0')}`;
}

export function todayLocal(): DateValue {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function formatDate(value: DateValue, locale: string): string {
  const date = toUtcDate(value);
  if (!date) {
    return '';
  }
  return formatter(normalizedLocale(locale), {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(date);
}

/** Parses the active locale's numeric order without introducing timezone math. */
export function parseLocalizedDate(input: string, locale: string): DateEntryState {
  const normalized = normalizeDigits(input.trim(), normalizedLocale(locale));
  if (!normalized) {
    return { kind: 'empty' };
  }

  const order = localeOrder(normalizedLocale(locale));
  let values: readonly string[];
  if (/^\d+$/.test(normalized)) {
    if (normalized.length < 8) {
      return { kind: 'partial' };
    }
    if (normalized.length > 8) {
      return { kind: 'invalid' };
    }
    values = order.map((part) => {
      const offset = order
        .slice(0, order.indexOf(part))
        .reduce((total, previous) => total + (previous === 'year' ? 4 : 2), 0);
      return normalized.slice(offset, offset + (part === 'year' ? 4 : 2));
    });
  } else {
    const unsupportedSeparators = normalized
      .replace(/\d/g, '')
      .replace(/[\s./\-\u061c\u200e\u200f]/g, '');
    if (unsupportedSeparators) {
      return { kind: 'invalid' };
    }
    values = normalized.match(/\d+/g) ?? [];
    if (values.length < 3) {
      return { kind: 'partial' };
    }
    if (values.length > 3) {
      return { kind: 'invalid' };
    }
  }

  const mapped = new Map<DatePart, string>();
  order.forEach((part, index) => mapped.set(part, values[index] ?? ''));
  const year = mapped.get('year') ?? '';
  const month = mapped.get('month') ?? '';
  const day = mapped.get('day') ?? '';
  if (year.length < 4) {
    return { kind: 'partial' };
  }
  if (year.length !== 4 || month.length > 2 || day.length > 2) {
    return { kind: 'invalid' };
  }

  const date = dateFromParts({
    year: Number(year),
    month: Number(month),
    day: Number(day),
  });
  return date ? { kind: 'valid', date } : { kind: 'invalid' };
}

export function createDateLocaleInfo(
  locale: string,
  firstDay: 'auto' | IsoWeekday = 'auto',
): DateLocaleInfo {
  const resolved = normalizedLocale(locale);
  const firstDayOfWeek = firstDay === 'auto' ? localeFirstDay(resolved) : firstDay;
  const dateFormatter = formatter(resolved, {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
  const placeholder = dateFormatter
    .formatToParts(REFERENCE_DATE)
    .map((part) => {
      if (part.type === 'day') return 'dd';
      if (part.type === 'month') return 'mm';
      if (part.type === 'year') return 'yyyy';
      return part.value;
    })
    .join('');

  const shortFormatter = formatter(resolved, { weekday: 'short' });
  const longFormatter = formatter(resolved, { weekday: 'long' });
  const weekdays: CalendarWeekday[] = Array.from({ length: 7 }, (_, index) => {
    const offset = (firstDayOfWeek - 1 + index) % 7;
    const date = new Date(MONDAY_REFERENCE);
    date.setUTCDate(date.getUTCDate() + offset);
    return {
      short: shortFormatter.format(date).replace(/\.$/, ''),
      label: longFormatter.format(date),
    };
  });

  return { locale: resolved, firstDayOfWeek, placeholder, weekdays };
}

export function isDateAllowed(value: DateValue, constraints: DateConstraints = {}): boolean {
  const date = toUtcDate(value);
  if (!date) {
    return false;
  }
  if (constraints.min && value < constraints.min) return false;
  if (constraints.max && value > constraints.max) return false;
  if (constraints.validDates && !constraints.validDates.includes(value)) {
    return false;
  }
  if (constraints.excludedDates?.includes(value)) return false;
  if (constraints.excludedWeekdays?.includes(isoWeekday(date))) return false;
  if (constraints.excludedRanges?.some((range) => value >= range.start && value <= range.end)) {
    return false;
  }
  return true;
}

/** The level of a free share, or `null` for a full or unknown day. */
export function availabilityLevel(share: number | undefined): AvailabilityLevel | null {
  if (share === undefined || !Number.isFinite(share) || share <= 0) return null;
  if (share > 0.5) return 'high';
  return share >= 0.2 ? 'medium' : 'low';
}

/** The free share per date, from per-day counts of free and total start times. */
export function availabilityFromCapacity(
  capacity: readonly {
    readonly date: DateValue;
    readonly freeSlots: number;
    readonly totalSlots: number;
  }[],
): DayAvailability {
  const shares: Record<DateValue, number> = {};
  for (const day of capacity) {
    if (day.totalSlots > 0) shares[day.date] = Math.min(1, day.freeSlots / day.totalSlots);
  }
  return shares;
}

export function createMonthGrid(
  month: MonthValue,
  localeInfo: DateLocaleInfo,
  constraints: DateConstraints,
  today: DateValue,
  availability: DayAvailability = {},
): readonly (readonly CalendarDay[])[] {
  if (!isCanonicalMonth(month)) {
    return [];
  }
  const first = `${month}-01`;
  const firstDate = toUtcDate(first);
  if (!firstDate) {
    return [];
  }
  const offset = (isoWeekday(firstDate) - localeInfo.firstDayOfWeek + 7) % 7;
  const gridStart = addDays(first, -offset);
  const labelFormatter = formatter(localeInfo.locale, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
  const days = Array.from({ length: 42 }, (_, index): CalendarDay => {
    const date = addDays(gridStart, index);
    const parts = parseIsoDate(date);
    const inCurrentMonth = date.startsWith(month);
    const disabled = !isDateAllowed(date, constraints);
    return {
      date,
      day: parts?.day ?? 0,
      label: labelFormatter.format(toUtcDate(date) ?? REFERENCE_DATE),
      inCurrentMonth,
      today: date === today,
      disabled,
      availability: inCurrentMonth && !disabled ? availabilityLevel(availability[date]) : null,
    };
  });
  return Array.from({ length: 6 }, (_, row) => days.slice(row * 7, row * 7 + 7));
}

export function formatMonthHeading(month: MonthValue, locale: string): string {
  const date = toUtcDate(`${month}-01`);
  return date
    ? formatter(normalizedLocale(locale), {
        month: 'long',
        year: 'numeric',
      }).format(date)
    : '';
}
