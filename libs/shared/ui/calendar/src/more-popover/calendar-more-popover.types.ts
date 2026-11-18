import type { CalendarEvent, CalendarResource } from '../calendar.types';

/** One row of the list, with its times already formatted. */
export interface MoreRow {
  readonly event: CalendarEvent;
  readonly resource: CalendarResource | null;
  readonly start: string;
  readonly end: string;
}
