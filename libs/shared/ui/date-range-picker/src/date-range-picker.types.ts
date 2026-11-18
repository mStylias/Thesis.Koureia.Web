import type { DateValue, MonthValue } from '@ui/date-picker';

/** Two canonical `YYYY-MM-DD` dates, both inclusive. Empty strings mean no range. */
export interface DateRangeDates {
  readonly from: DateValue;
  readonly to: DateValue;
}

/**
 * The picker's value. `preset` names the preset that produced the dates, so a consumer can store
 * the preset instead of the dates and resolve it again later. It is `null` for a range the user
 * picked or typed.
 */
export interface DateRangeValue extends DateRangeDates {
  readonly preset: string | null;
}

/** A named range offered beside the calendar. */
export interface DateRangePreset {
  /** Stable id, such as `last30`. Written to `DateRangeValue.preset`. */
  readonly id: string;
  /**
   * Visible name. When omitted, the picker translates `dateRangePicker.presets.<id>`, which
   * exists for the built-in presets only.
   */
  readonly label?: string;
  /** The dates this preset covers, counted from `today`. */
  readonly resolve: (today: DateValue) => DateRangeDates;
}

export type DateRangePickerSize = 'sm' | 'md' | 'lg';

/** Why typed or validated dates were refused. */
export type DateRangeErrorKind =
  | 'required'
  | 'dateFormat'
  | 'dateUnavailable'
  | 'rangeOrder'
  | 'rangeTooLong';

/** The limits shared by the picker and `validateDateRange`. */
export interface DateRangeConstraints {
  /** Earliest selectable date, inclusive. */
  readonly min?: DateValue;
  /** Latest selectable date, inclusive. */
  readonly max?: DateValue;
  /** Longest range in days, both ends counted. */
  readonly maxDays?: number;
}

/** One day of a calendar month, with its place in the range. */
export interface RangeCalendarDay {
  readonly date: DateValue;
  readonly day: number;
  readonly label: string;
  readonly inCurrentMonth: boolean;
  readonly today: boolean;
  readonly disabled: boolean;
  readonly rangeStart: boolean;
  readonly rangeEnd: boolean;
  readonly inRange: boolean;
}

/** One month of the panel. */
export interface RangeCalendarMonth {
  readonly month: MonthValue;
  readonly heading: string;
  readonly headingId: string;
  readonly weeks: readonly (readonly RangeCalendarDay[])[];
}
