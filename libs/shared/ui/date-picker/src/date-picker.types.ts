/** A local Gregorian calendar date in canonical `YYYY-MM-DD` form. */
export type DateValue = string;

/** A Gregorian calendar month in canonical `YYYY-MM` form. */
export type MonthValue = string;

/** ISO weekday: Monday is 1 and Sunday is 7. */
export type IsoWeekday = 1 | 2 | 3 | 4 | 5 | 6 | 7;

export type DatePickerMode = 'dropdown' | 'inline';
export type DatePickerSize = 'sm' | 'md' | 'lg';

/** An inclusive local-date range. */
export interface DateRange {
  readonly start: DateValue;
  readonly end: DateValue;
}

/** Shared availability constraints used by the picker and `validateDate`. */
export interface DateConstraints {
  /** Earliest selectable date (inclusive). */
  readonly min?: DateValue;
  /** Latest selectable date (inclusive). */
  readonly max?: DateValue;
  /** When set, only these exact dates are selectable. An empty list allows no date. */
  readonly validDates?: readonly DateValue[];
  /** Exact unavailable dates. */
  readonly excludedDates?: readonly DateValue[];
  /** Inclusive unavailable ranges. */
  readonly excludedRanges?: readonly DateRange[];
  /** Recurring unavailable weekdays, using ISO weekday numbers. */
  readonly excludedWeekdays?: readonly IsoWeekday[];
}

/** The share of a day's capacity that is still free, from `0` (full) to `1` (empty), per date. */
export type DayAvailability = Readonly<Partial<Record<DateValue, number>>>;

/** How much of a day is free: `low` below 20%, `medium` from 20% to 50%, `high` above 50%. */
export type AvailabilityLevel = 'low' | 'medium' | 'high';

export interface CalendarDay {
  readonly date: DateValue;
  readonly day: number;
  readonly label: string;
  readonly inCurrentMonth: boolean;
  readonly today: boolean;
  readonly disabled: boolean;
  /** Set only on a selectable day of the shown month that has a free share above `0`. */
  readonly availability: AvailabilityLevel | null;
}

export interface CalendarWeekday {
  readonly short: string;
  readonly label: string;
}

export interface DateLocaleInfo {
  readonly locale: string;
  readonly firstDayOfWeek: IsoWeekday;
  readonly placeholder: string;
  readonly weekdays: readonly CalendarWeekday[];
}

export type DateEntryState =
  | { readonly kind: 'empty' }
  | { readonly kind: 'partial' }
  | { readonly kind: 'invalid' }
  | { readonly kind: 'valid'; readonly date: DateValue };
