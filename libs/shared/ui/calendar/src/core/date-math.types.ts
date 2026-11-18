import type { DateValue } from '@ui/date-picker';
import type { TimeValue } from '@ui/time-picker';

/** A wall-clock reading in one time zone. */
export interface ZoneClock {
  readonly date: DateValue;
  readonly time: TimeValue;
  /** Minutes since the start of `date`. */
  readonly minutes: number;
}
