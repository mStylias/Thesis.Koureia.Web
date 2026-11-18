import type { AppointmentsStore } from './appointments.store';

/** What the column factory reads. Plain values, so a column list is rebuilt per language. */
export interface AppointmentColumnsDeps {
  /** Resolves a key of this page's scope or of the drawer's, with parameters. */
  readonly translate: (key: string, params?: Record<string, unknown>) => string;
  /** The active language, for the date format. */
  readonly language: string;
  /** The shop's IANA zone. */
  readonly timezone: string;
  readonly store: AppointmentsStore;
}
