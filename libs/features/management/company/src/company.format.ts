import type { Translate } from './company.format.types';

const K = 'managementCompany.durations';

const MINUTES_PER_HOUR = 60;
const MINUTES_PER_DAY = 24 * MINUTES_PER_HOUR;
const MS_PER_DAY = MINUTES_PER_DAY * 60 * 1000;

/**
 * Minutes in the largest whole unit: `30 λεπτά`, `1 ώρα`, `2 ώρες`, `1 ημέρα`. A length that is
 * not a whole number of hours stays in minutes, as `90 λεπτά`.
 */
export function formatMinutes(minutes: number, translate: Translate): string {
  if (minutes > 0 && minutes % MINUTES_PER_DAY === 0) {
    return formatDays(minutes / MINUTES_PER_DAY, translate);
  }
  if (minutes > 0 && minutes % MINUTES_PER_HOUR === 0) {
    const hours = minutes / MINUTES_PER_HOUR;
    return hours === 1 ? translate(`${K}.hour`) : translate(`${K}.hours`, { count: hours });
  }
  return minutes === 1 ? translate(`${K}.minute`) : translate(`${K}.minutes`, { count: minutes });
}

/** `1 ημέρα`, `60 ημέρες`. */
export function formatDays(days: number, translate: Translate): string {
  return days === 1 ? translate(`${K}.day`) : translate(`${K}.days`, { count: days });
}

/**
 * An inclusive span of shop-local `YYYY-MM-DD` days as one date range: `24 Δεκ`, `14–17 Απρ`,
 * `30 Δεκ 2026 – 2 Ιαν 2027`. The year shows when a day is not in `thisYear`. Read in UTC, so the
 * browser's own zone cannot move a day.
 */
export function formatDateRange(
  startsOn: string,
  endsOn: string,
  language: string,
  thisYear: number,
): string {
  const start = new Date(`${startsOn}T00:00:00Z`);
  const end = new Date(`${endsOn}T00:00:00Z`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return startsOn === endsOn ? startsOn : `${startsOn} – ${endsOn}`;
  }
  const otherYear = start.getUTCFullYear() !== thisYear || end.getUTCFullYear() !== thisYear;
  const format = new Intl.DateTimeFormat(language, {
    day: 'numeric',
    month: 'short',
    year: otherYear ? 'numeric' : undefined,
    timeZone: 'UTC',
  });
  return startsOn === endsOn ? format.format(start) : format.formatRange(start, end);
}

/** The shop-local calendar day of an instant, as `YYYY-MM-DD`. */
export function shopToday(timezone: string, now: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
}

/** Whole days from one `YYYY-MM-DD` to another. */
export function daysBetween(from: string, to: string): number {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / MS_PER_DAY);
}

/** The `YYYY-MM-DD` that is `days` after `day`. A negative count goes back. */
export function addDays(day: string, days: number): string {
  return new Date(Date.parse(`${day}T00:00:00Z`) + days * MS_PER_DAY).toISOString().slice(0, 10);
}
