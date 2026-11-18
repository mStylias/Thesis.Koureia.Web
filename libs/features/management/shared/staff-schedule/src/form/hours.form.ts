import { applyEach, applyWhen, validate, type SchemaPathTree } from '@angular/forms/signals';

import { overlapsEarlier, toMinutes } from './hours-draft';
import type { HoursFormValue, HoursRangeFormValue } from './hours.form.types';

/** The API stores minutes in steps of this. */
export const HOURS_MINUTE_STEP = 5;

const K = 'managementStaffSchedule.hours.errors';

/**
 * Every range of a working day: both ends, in steps of five, the end after the start, and no
 * overlap with an earlier range of the day. A day off is not checked: it sends nothing.
 */
export function hoursRules(path: SchemaPathTree<HoursFormValue>): void {
  applyEach(path.days, (day) => {
    applyWhen(
      day,
      ({ value }) => value().working,
      (working) => {
        applyEach(working.ranges, (range) => {
          validate(range, (context) =>
            rangeError(context.value(), context.valueOf(working.ranges), context.index()),
          );
        });
      },
    );
  });
}

/** The first thing wrong with one range, as a message key, or `undefined`. */
export function rangeError(
  range: HoursRangeFormValue,
  ranges: readonly HoursRangeFormValue[],
  index: number,
): { kind: string; message: string } | undefined {
  const start = toMinutes(range.startTime);
  const end = toMinutes(range.endTime);
  if (start === null || end === null) return { kind: 'required', message: `${K}.required` };
  if (start % HOURS_MINUTE_STEP !== 0 || end % HOURS_MINUTE_STEP !== 0) {
    return { kind: 'step', message: `${K}.step` };
  }
  if (end <= start) return { kind: 'order', message: `${K}.order` };
  if (overlapsEarlier(ranges, index)) return { kind: 'overlap', message: `${K}.overlap` };
  return undefined;
}
