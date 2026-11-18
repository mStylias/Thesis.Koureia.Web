/**
 * How the drawer writes dates, instants and money. Shop-local dates are read as calendar days in
 * UTC, so no time zone moves them. Instants are written in the shop's time zone.
 */

/** `Τετάρτη 24 Σεπτεμβρίου 2026` for `2026-09-24`. */
export function formatLocalDate(date: string, language: string): string {
  const day = localDay(date);
  if (day === null) return date;
  return new Intl.DateTimeFormat(language, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(day);
}

/** `24 Σεπ` for `2026-09-24`, the short form of a list row. */
export function formatShortDate(date: string, language: string): string {
  const day = localDay(date);
  if (day === null) return date;
  return new Intl.DateTimeFormat(language, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(day);
}

/** An ISO instant as date and time in the shop's time zone. */
export function formatInstant(instant: string, language: string, timeZone: string): string {
  const value = new Date(instant);
  if (Number.isNaN(value.getTime())) return instant;
  return new Intl.DateTimeFormat(language, {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone,
  }).format(value);
}

export function formatMoney(amount: number, currency: string, language: string): string {
  return new Intl.NumberFormat(language, { style: 'currency', currency }).format(amount);
}

function localDay(date: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  if (match === null) return null;
  return new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
}
