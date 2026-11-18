import type { Signal } from '@angular/core';
import type { BusinessHourViewDto } from '@api/appointments';

/** The shop facts the hours and time-off editors read from their host page. */
export interface StaffScheduleContext {
  /** The shop's opening hours, ISO `dayOfWeek`. Empty until the host has them. */
  readonly businessHours: Signal<readonly BusinessHourViewDto[]>;
  /** The step of the time pickers, in minutes. */
  readonly slotIntervalMinutes: Signal<number>;
  /** The shop's IANA zone. "Today" and the default time-off day use it. */
  readonly timezone: Signal<string>;
}
