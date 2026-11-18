/**
 * One shop-local day, written the way the language writes a day: `Παρ 25 Σεπ`.
 *
 * The date is parsed at UTC midnight and formatted in UTC. It is already the shop's day — the
 * browser's zone must not be allowed to shift it onto another one.
 */
export function formatShopDate(date: string, locale: string, long = false): string {
  const parsed = new Date(`${date}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime())) return date;

  return new Intl.DateTimeFormat(locale, {
    weekday: long ? 'long' : 'short',
    day: 'numeric',
    month: long ? 'long' : 'short',
    timeZone: 'UTC',
  }).format(parsed);
}

/** `50′`. Minutes, in the typographic prime the design uses for durations. */
export function formatDuration(minutes: number): string {
  return `${minutes}′`;
}

/** `€25`, or `€25,50` where the amount has cents. */
export function formatPrice(amount: number, currency: string, locale: string): string {
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    // A whole amount reads better without the zeros, and most prices here are whole.
    minimumFractionDigits: Number.isInteger(amount) ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

/**
 * An instant as the shop's wall clock reads it: `Παρ 25 Σεπ, 17:30`.
 *
 * For a deadline the API gives as UTC, such as the last moment to cancel. `timeZone` is the
 * shop's IANA zone, so the answer is the same on every visitor's device.
 */
export function formatShopInstant(instantUtc: string, timeZone: string, locale: string): string {
  const parsed = new Date(instantUtc);
  if (Number.isNaN(parsed.getTime())) return instantUtc;

  return new Intl.DateTimeFormat(locale, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
    timeZone,
  }).format(parsed);
}

/** The shop's wall clock at an instant: `17:30`. */
export function formatShopTime(instantUtc: string, timeZone: string, locale: string): string {
  const parsed = new Date(instantUtc);
  if (Number.isNaN(parsed.getTime())) return instantUtc;

  return new Intl.DateTimeFormat(locale, {
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
    timeZone,
  }).format(parsed);
}

const DAY_MS = 86_400_000;
const DAYS_PER_WEEK = 7;
const DAYS_PER_MONTH = 30.4375;
const DAYS_PER_YEAR = 365.25;
const MONTHS_PER_YEAR = 12;
const WEEKS_UNTIL = 30;

/**
 * How far a shop-local day is from the shop's today, as a person says it: `Αύριο`,
 * `Σε 5 ημέρες`, `Πριν από 2 μήνες`. A label that stands alone, so it starts with a capital.
 *
 * Days under a week, weeks under a month, months under a year, then years. Only days use the
 * language's own words, such as `αύριο`. `Next month` names the calendar month, not 30 days.
 */
export function formatRelativeDay(
  date: string,
  timeZone: string,
  locale: string,
  now: number = Date.now(),
): string {
  const day = Date.parse(`${date}T00:00:00Z`);
  if (Number.isNaN(day)) return date;

  const today = Date.parse(`${shopToday(timeZone, now)}T00:00:00Z`);
  const [value, unit] = relativeUnit(Math.round((day - today) / DAY_MS));
  const text = new Intl.RelativeTimeFormat(locale, {
    numeric: unit === 'day' ? 'auto' : 'always',
  }).format(value, unit);

  return text.charAt(0).toLocaleUpperCase(locale) + text.slice(1);
}

/** The shop's today as `YYYY-MM-DD`. */
function shopToday(timeZone: string, now: number): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    timeZone,
  }).formatToParts(now);
  const part = (type: Intl.DateTimeFormatPartTypes): string =>
    parts.find((entry) => entry.type === type)?.value ?? '';

  return `${part('year')}-${part('month')}-${part('day')}`;
}

function relativeUnit(days: number): [number, Intl.RelativeTimeFormatUnit] {
  const size = Math.abs(days);
  if (size < DAYS_PER_WEEK) return [days, 'day'];
  if (size < WEEKS_UNTIL) return [Math.round(days / DAYS_PER_WEEK), 'week'];

  const months = Math.round(days / DAYS_PER_MONTH);
  if (Math.abs(months) < MONTHS_PER_YEAR) return [months, 'month'];
  return [Math.round(days / DAYS_PER_YEAR), 'year'];
}
