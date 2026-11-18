/**
 * Fictional content for the stories, anchored to the date the story is opened
 * on so the today marks show. Not part of the public API.
 */
import type { DateValue } from '@ui/date-picker';
import type { CalendarEvent, CalendarHours, CalendarResource } from '../calendar.types';
import { isoWeekdayOf, monthGridDays, monthOf, timeOf, yearMonths } from '../core/date-math';

export const DEMO_RESOURCES: readonly CalendarResource[] = [
  { id: 'a', label: 'Θέση Α', swatch: 1, initials: 'Α' },
  { id: 'b', label: 'Θέση Β', swatch: 2, initials: 'Β' },
  { id: 'c', label: 'Θέση Γ', swatch: 3, initials: 'Γ' },
];

export const DEMO_HOURS: readonly CalendarHours[] = [
  { weekday: 1, open: '09:00', close: '20:00' },
  { weekday: 2, open: '09:00', close: '20:00' },
  { weekday: 3, open: '09:00', close: '20:00' },
  { weekday: 4, open: '09:00', close: '20:00' },
  { weekday: 5, open: '09:00', close: '20:00' },
  { weekday: 6, open: '09:00', close: '16:00' },
];

const TITLES = ['Ελένη Π.', 'Νίκος Κ.', 'Μαρία Δ.', 'Γιώργος Α.', 'Άννα Σ.', 'Κώστας Μ.'];
const SUBTITLES = ['Συνάντηση', 'Παρουσίαση', 'Επισκόπηση', 'Συμβουλευτική'];
const BADGES: readonly CalendarEvent['badge'][] = [
  { label: 'Επιβεβαιωμένο', tone: 'success' },
  undefined,
  { label: 'Σε αναμονή', tone: 'warning' },
];

/** A deterministic count for a day: nothing on Sundays, up to seven otherwise. */
function countFor(date: DateValue): number {
  if (isoWeekdayOf(date) === 7) {
    return 0;
  }
  const day = Number(date.slice(8));
  const month = Number(date.slice(5, 7));
  return (day * 7 + month * 3) % 8;
}

/** The events of every day the month grid around `anchor` draws. */
export function demoMonthEvents(anchor: DateValue): readonly CalendarEvent[] {
  const events: CalendarEvent[] = [];
  for (const date of monthGridDays(monthOf(anchor), 1)) {
    const count = countFor(date);
    const day = Number(date.slice(8));
    for (let index = 0; index < count; index += 1) {
      const start = 9 * 60 + ((day * 3 + index * 5) % 9) * 60 + (index % 2) * 30;
      const length = [30, 45, 60, 90][(day + index) % 4] ?? 30;
      const serial = day * 7 + index;
      events.push({
        id: `${date}-${index.toString()}`,
        date,
        start: timeOf(start),
        end: timeOf(start + length),
        title: TITLES[serial % TITLES.length] ?? '',
        subtitle: SUBTITLES[serial % SUBTITLES.length],
        resourceId: DEMO_RESOURCES[serial % DEMO_RESOURCES.length]?.id,
        badge: BADGES[serial % BADGES.length],
        muted: serial % 11 === 0,
      });
    }
  }
  return events;
}

/** Per-day counts for a whole year, for the year view. */
export function demoDayCounts(year: number): Readonly<Record<DateValue, number>> {
  const counts: Record<DateValue, number> = {};
  for (const month of yearMonths(year)) {
    for (const date of monthGridDays(month, 1)) {
      if (monthOf(date) !== month) {
        continue;
      }
      const count = countFor(date);
      if (count > 0) {
        counts[date] = count;
      }
    }
  }
  return counts;
}
