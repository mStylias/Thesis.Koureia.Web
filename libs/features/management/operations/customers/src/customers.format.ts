/**
 * How the page writes days, instants and money. A shop-local day is read as a calendar day in
 * UTC, so no zone moves it. An instant is written in the shop's zone.
 */

/** `24 Σεπ 2026` for `2026-09-24`. Anything else comes back as it is. */
export function formatDay(value: unknown, language: string): string {
  if (typeof value !== 'string') return '';
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (match === null) return value;
  const day = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
  return new Intl.DateTimeFormat(language, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(day);
}

/** An ISO instant as date and time in the shop's zone. */
export function formatInstant(value: unknown, language: string, timeZone: string): string {
  if (typeof value !== 'string') return '';
  const instant = new Date(value);
  if (Number.isNaN(instant.getTime())) return value;
  return new Intl.DateTimeFormat(language, {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone,
  }).format(instant);
}

/** Two initials from the names, for the drawer's circle. */
export function initialsOf(firstName: string, lastName: string, displayName: string): string {
  const letters = [firstName, lastName]
    .map((part) => part.trim().charAt(0))
    .filter((letter) => letter !== '');
  const initials = letters.length > 0 ? letters.join('') : displayName.trim().charAt(0);
  return initials.toLocaleUpperCase();
}
