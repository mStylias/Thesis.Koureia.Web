/** One range of a working day, shop-local `HH:mm`. Empty while the user has not picked a time. */
export interface HoursRangeFormValue {
  startTime: string;
  endTime: string;
}

/** One weekday, ISO `dayOfWeek`. A day off keeps its ranges in the form but sends none. */
export interface HoursDayFormValue {
  dayOfWeek: number;
  working: boolean;
  ranges: HoursRangeFormValue[];
}

/** The week, Monday first. Always seven days. */
export interface HoursFormValue {
  days: HoursDayFormValue[];
}

/** The day and range a request's `workHours[i]` came from. */
export interface HoursRangeRef {
  readonly day: number;
  readonly range: number;
}

/** A shop-local window, in minutes since midnight. */
export interface MinuteWindow {
  readonly start: number;
  readonly end: number;
}

/** One range of the week as a request sends it: the day and the shop-local times. */
export interface WeekRange {
  readonly dayOfWeek: number;
  readonly startTime: string;
  readonly endTime: string;
}
