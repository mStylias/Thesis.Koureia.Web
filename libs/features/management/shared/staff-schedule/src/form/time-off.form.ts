import {
  applyWhen,
  metadata,
  required,
  validate,
  REQUIRED,
  type SchemaPathTree,
} from '@angular/forms/signals';
import type { CreateStaffTimeOffRequest, StaffTimeOffResponse } from '@api/staff';
import { field, fields } from '@util/forms';

import type { TimeOffFormValue } from './time-off.form.types';

/** The API's limit on the reason. */
export const REASON_MAX_LENGTH = 200;

const K = 'managementStaffSchedule.timeOff';

export const TIME_OFF_FIELDS = fields<TimeOffFormValue>({
  startsOn: field({ label: `${K}.startsOn`, required: `${K}.errors.startsOnRequired` }),
  endsOn: field({ label: `${K}.endsOn`, required: `${K}.errors.endsOnRequired` }),
  wholeDays: field({ label: `${K}.wholeDays` }),
  startTime: field({ label: `${K}.startTime` }),
  endTime: field({ label: `${K}.endTime` }),
  reason: field({
    label: `${K}.reason`,
    maxLength: [REASON_MAX_LENGTH, `${K}.errors.reasonTooLong`],
  }),
});

/**
 * Both times on a time off that is not whole days, and an end after the start. Dates and times
 * compare as text: both are zero-padded.
 */
export function timeOffRules(path: SchemaPathTree<TimeOffFormValue>): void {
  applyWhen(
    path,
    ({ value }) => !value().wholeDays,
    (partial) => {
      required(partial.startTime, { message: `${K}.errors.timeRequired` });
      required(partial.endTime, { message: `${K}.errors.timeRequired` });
    },
  );
  validate(path.endsOn, (context) => {
    const startsOn = context.valueOf(path.startsOn);
    const endsOn = context.value();
    if (startsOn === '' || endsOn === '') return undefined;
    const wholeDays = context.valueOf(path.wholeDays);
    const start = wholeDays ? startsOn : `${startsOn}T${context.valueOf(path.startTime)}`;
    const end = wholeDays ? endsOn : `${endsOn}T${context.valueOf(path.endTime)}`;
    const ordered = wholeDays ? end >= start : end > start;
    return ordered ? undefined : { kind: 'order', message: `${K}.errors.endsBeforeStart` };
  });
}

/**
 * The times' required marker, outside the commit gate. The gated `required` alone puts the
 * asterisk on only after the first save.
 */
export function timeOffLiveRules(path: SchemaPathTree<TimeOffFormValue>): void {
  metadata(path.startTime, REQUIRED, (context) => !context.valueOf(path.wholeDays));
  metadata(path.endTime, REQUIRED, (context) => !context.valueOf(path.wholeDays));
}

/** A new time off: one whole day, today. */
export function emptyTimeOff(today: string): TimeOffFormValue {
  return {
    startsOn: today,
    endsOn: today,
    wholeDays: true,
    startTime: '',
    endTime: '',
    reason: '',
  };
}

export function timeOffForm(timeOff: StaffTimeOffResponse): TimeOffFormValue {
  const wholeDays = timeOff.startTime === null || timeOff.endTime === null;
  return {
    startsOn: timeOff.startsOn,
    endsOn: timeOff.endsOn,
    wholeDays,
    startTime: timeOff.startTime ?? '',
    endTime: timeOff.endTime ?? '',
    reason: timeOff.reason ?? '',
  };
}

/** Whole days send no times. An empty reason is `null`. */
export function timeOffRequest(value: TimeOffFormValue): CreateStaffTimeOffRequest {
  const reason = value.reason.trim();
  return {
    startsOn: value.startsOn,
    endsOn: value.endsOn,
    startTime: value.wholeDays ? null : value.startTime,
    endTime: value.wholeDays ? null : value.endTime,
    reason: reason === '' ? null : reason,
  };
}
