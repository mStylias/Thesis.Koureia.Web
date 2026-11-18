/**
 * A shop-local `YYYY-MM-DD` as `12 Οκτ`, with the year when it is not `thisYear`. Read in UTC, so
 * the browser's own zone cannot move it a day.
 */
export function formatDay(day: string, language: string, thisYear?: number): string {
  const date = new Date(`${day}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return day;
  return new Intl.DateTimeFormat(language, {
    day: 'numeric',
    month: 'short',
    year: thisYear === undefined || date.getUTCFullYear() !== thisYear ? 'numeric' : undefined,
    timeZone: 'UTC',
  }).format(date);
}

/** `12 Οκτ – 14 Οκτ` for an inclusive span. One day reads as one date. */
export function formatSpan(startsOn: string, endsOn: string, language: string): string {
  const year = new Date().getFullYear();
  return startsOn === endsOn
    ? formatDay(startsOn, language, year)
    : `${formatDay(startsOn, language, year)} – ${formatDay(endsOn, language, year)}`;
}

/** The shop-local calendar day and `HH:mm` of a UTC instant. */
export function localParts(
  instant: Date,
  timezone: string,
): { readonly day: string; readonly time: string } {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(instant);
  const part = (type: Intl.DateTimeFormatPartTypes): string =>
    parts.find((item) => item.type === type)?.value ?? '';
  return {
    day: `${part('year')}-${part('month')}-${part('day')}`,
    time: `${part('hour')}:${part('minute')}`,
  };
}
