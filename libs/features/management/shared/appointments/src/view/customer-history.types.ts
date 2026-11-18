import type { AppointmentODataResponse } from '@api/appointments';
import type { HISTORY_FIELDS } from './customer-history';

/** An appointment to show in the drawer, with the date the page moves to. */
export interface OpenAppointment {
  readonly id: string;
  readonly localDate: string;
}

/** A history row, narrowed to the members the list reads. */
export type HistoryRow = Pick<AppointmentODataResponse, (typeof HISTORY_FIELDS)[number]>;

/** The history on one side of now. */
export interface HistoryGroup {
  readonly key: 'upcoming' | 'past';
  readonly rows: readonly HistoryRow[];
}
