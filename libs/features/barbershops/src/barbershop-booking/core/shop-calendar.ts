/**
 * Shop-local calendar arithmetic.
 *
 * Every day the booking flow names is the shop's, not the browser's: a customer in London
 * booking in Athens picks Athens days. The browser's own date is never used as a boundary.
 */

/** Today, in the shop's timezone. `en-CA` is the locale whose short date is already ISO. */
export function shopToday(timezone: string): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: timezone }).format(new Date());
}

/** `date` moved by whole days. Both are shop-local `YYYY-MM-DD`. */
export function addDays(date: string, days: number): string {
  const moved = new Date(`${date}T00:00:00Z`);
  moved.setUTCDate(moved.getUTCDate() + days);
  return moved.toISOString().slice(0, 10);
}

/** The window the calendar opens: today through the shop's horizon. */
export function bookingWindow(
  timezone: string,
  maxAdvanceDays: number,
): { readonly from: string; readonly to: string } {
  const from = shopToday(timezone);
  return { from, to: addDays(from, Math.max(0, maxAdvanceDays)) };
}

/** Whether the shop keeps time somewhere other than where the customer is standing. */
export function timezoneDiffers(timezone: string): boolean {
  try {
    return new Intl.DateTimeFormat().resolvedOptions().timeZone !== timezone;
  } catch {
    return false;
  }
}

/** The shop's city, as the timezone spells it: `Europe/Athens` reads `Athens`. */
export function timezoneCity(timezone: string): string {
  return (timezone.split('/').pop() ?? timezone).replace(/_/g, ' ');
}
