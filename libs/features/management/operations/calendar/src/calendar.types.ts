import type { AppointmentODataResponse, AppointmentsQuery } from '@api/appointments';
import type { Result } from '@synax/client/core';
import type { CalendarDayColumns, CalendarTimeScale, CalendarView } from '@ui/calendar';
import type { DateValue } from '@ui/date-picker';

import type { CALENDAR_APPOINTMENT_FIELDS } from './calendar-mapping';

/** The four facets of the filters panel. An empty list means all. */
export interface CalendarFilters {
  barberIds: string[];
  customerIds: string[];
  statuses: string[];
  categoryIds: string[];
}

/**
 * What a saved view stores: the filters, the calendar view and the settings. The date and the
 * open panel are not part of one, so applying a view never jumps to a fixed day.
 */
export interface CalendarViewState {
  readonly version: 1;
  readonly filters: CalendarFilters;
  readonly view: CalendarView;
  readonly timeScale: CalendarTimeScale;
  readonly dayColumns: CalendarDayColumns;
  readonly showTime: boolean;
}

/**
 * The `calendar_settings` user resource: the last view and the settings panel's choices. The
 * browser keeps a copy for the first frame, and the open panel. See `calendar-browser-storage.ts`.
 */
export interface CalendarSettings {
  readonly version: 1;
  readonly view: CalendarView;
  readonly timeScale: CalendarTimeScale;
  readonly dayColumns: CalendarDayColumns;
  readonly showTime: boolean;
}

/** Where the calendar stands, as the address carries it. */
export interface CalendarPosition {
  readonly view: CalendarView;
  /** `''` means today. */
  readonly anchor: DateValue;
  readonly dayColumns: CalendarDayColumns;
}

/** The query parameters of the calendar's address. Absent members are left out of the URL. */
export interface CalendarPositionParams {
  readonly view?: string;
  readonly date?: string;
  readonly columns?: string;
}

/** The slot a create was started from, carried by `new` as query parameters. */
export interface CalendarSlotParams {
  readonly slotDate?: string;
  readonly slotTime?: string;
  readonly barberId?: string;
  /** "Book again": the appointment the create copies. */
  readonly rebook?: string;
}

/** An appointment row narrowed to the members the calendar selects. */
export type CalendarAppointmentRow = Pick<
  AppointmentODataResponse,
  (typeof CALENDAR_APPOINTMENT_FIELDS)[number]
>;

/** One answer of the appointments endpoint, with the query it answers. */
export interface AppointmentsQueryResult {
  readonly query: AppointmentsQuery;
  readonly result: Result<readonly CalendarAppointmentRow[]>;
}

/** A resource's value with the shop it was read for, so a shop change can drop it. */
export interface ShopScoped<T> {
  readonly companyId: string | null;
  readonly value: T | undefined;
}

/** The appointments of the last successful load, and the range they answer for. */
export interface LoadedAppointments {
  readonly from: DateValue;
  readonly to: DateValue;
  readonly rows: readonly CalendarAppointmentRow[];
}

/** The copy the event mapping needs, resolved once per language. */
export interface CalendarEventCopy {
  readonly status: (status: string) => string;
  /** The mark of a customer blocked from online booking. */
  readonly blocked: string;
  /** The mark of a customer the shop keeps a note on. */
  readonly note: string;
}
