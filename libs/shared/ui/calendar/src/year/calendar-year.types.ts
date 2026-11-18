import type { DateValue, MonthValue } from '@ui/date-picker';

/** One day of a mini month. */
export interface YearDay {
  readonly date: DateValue;
  readonly day: number;
  /** A padding day of another month, drawn empty. */
  readonly outside: boolean;
  readonly today: boolean;
  readonly closed: boolean;
  readonly count: number;
  /** The tint step for `count`. */
  readonly step: 0 | 1 | 2 | 3;
  /** The full date, for the cell's accessible name. */
  readonly label: string;
}

export interface YearMonth {
  readonly month: MonthValue;
  readonly heading: string;
  readonly weeks: readonly (readonly YearDay[])[];
}
