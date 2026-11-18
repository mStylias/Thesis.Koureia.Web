import type { CalendarBadge, CalendarEventMark, CalendarResource } from '../calendar.types';

/**
 * What follows the times and the title in an event's accessible name: the
 * resource, then the badge, then the marks. `resourceLabel` is the host's noun for a resource,
 * so a listener hears "Barber: Nikos P." rather than a bare name. Empty names
 * the resource alone.
 *
 * Every view names its events through this, so a tile, a month row, an agenda
 * row and a "+N" row read the same.
 */
export function eventNameParts(
  resource: CalendarResource | null,
  badge: CalendarBadge | undefined,
  resourceLabel: string,
  marks: readonly CalendarEventMark[] = [],
): string[] {
  const parts: string[] = [];
  if (resource !== null) {
    parts.push(resourceLabel === '' ? resource.label : `${resourceLabel}: ${resource.label}`);
  }
  if (badge !== undefined) {
    parts.push(badge.label);
  }
  for (const mark of marks) {
    parts.push(mark.label);
  }
  return parts;
}

/** {@link eventNameParts} as a suffix, each part led by a comma, for a name built in a template. */
export function eventNameSuffix(
  resource: CalendarResource | null,
  badge: CalendarBadge | undefined,
  resourceLabel: string,
  marks: readonly CalendarEventMark[] = [],
): string {
  return eventNameParts(resource, badge, resourceLabel, marks)
    .map((part) => `, ${part}`)
    .join('');
}
