import type { DateValue } from '@ui/date-picker';
import type { CalendarEvent, CalendarResource } from '../calendar.types';

/** One event row, with its resource and its times already formatted. */
export interface AgendaRow {
  readonly event: CalendarEvent;
  readonly resource: CalendarResource | null;
  readonly start: string;
  readonly end: string;
}

/** One day with something on it. Days with nothing are not listed. */
export interface AgendaGroup {
  readonly date: DateValue;
  readonly label: string;
  readonly today: boolean;
  readonly rows: readonly AgendaRow[];
}
