import {
  applyWhen,
  metadata,
  required,
  validate,
  REQUIRED,
  type SchemaPathTree,
} from '@angular/forms/signals';
import type { CompanyHolidayResponse, CreateCompanyHolidayRequest } from '@api/company';
import { HOURS_MINUTE_STEP } from '@features/management-shared-staff-schedule';
import { field, fields } from '@util/forms';

import { daysBetween } from '../company.format';
import type { ClosureFormValue } from './closure.form.types';

/** The API's limit on the name. */
export const CLOSURE_NAME_MAX_LENGTH = 200;

/** The API's limit on one range, both days counted. */
export const CLOSURE_MAX_DAYS = 366;

const K = 'managementCompany.closures.dialog';

export const CLOSURE_FIELDS = fields<ClosureFormValue>({
  startsOn: field({ label: `${K}.startsOn`, required: `${K}.errors.startsOnRequired` }),
  endsOn: field({ label: `${K}.endsOn`, required: `${K}.errors.endsOnRequired` }),
  closedAllDay: field({ label: `${K}.closedAllDay` }),
  openTime: field({ label: `${K}.openTime` }),
  closeTime: field({ label: `${K}.closeTime` }),
  name: field({
    label: `${K}.name`,
    maxLength: [CLOSURE_NAME_MAX_LENGTH, `${K}.errors.nameTooLong`],
  }),
});

/**
 * The checks before a request: no day before today (except the first day of a started closure),
 * the end not before the start, at most {@link CLOSURE_MAX_DAYS} days, and for special hours both
 * times in steps of five with the close after the open. Dates and times compare as text: both are
 * zero-padded.
 */
export function closureRules(
  path: SchemaPathTree<ClosureFormValue>,
  today: () => string,
  started: () => boolean,
): void {
  validate(path.startsOn, (context) => {
    const startsOn = context.value();
    return startsOn === '' || started() || startsOn >= today()
      ? undefined
      : { kind: 'past', message: `${K}.errors.past` };
  });
  validate(path.endsOn, (context) => {
    const startsOn = context.valueOf(path.startsOn);
    const endsOn = context.value();
    if (endsOn === '') return undefined;
    if (endsOn < today()) return { kind: 'past', message: `${K}.errors.past` };
    if (startsOn === '') return undefined;
    if (endsOn < startsOn) return { kind: 'order', message: `${K}.errors.order` };
    return daysBetween(startsOn, endsOn) >= CLOSURE_MAX_DAYS
      ? { kind: 'span', message: `${K}.errors.span` }
      : undefined;
  });
  applyWhen(
    path,
    ({ value }) => !value().closedAllDay,
    (special) => {
      required(special.openTime, { message: `${K}.errors.timeRequired` });
      required(special.closeTime, { message: `${K}.errors.timeRequired` });
      validate(special.openTime, (context) => stepError(context.value()));
      validate(special.closeTime, (context) => {
        const closeTime = context.value();
        const openTime = context.valueOf(special.openTime);
        if (closeTime === '' || openTime === '') return stepError(closeTime);
        return closeTime <= openTime
          ? { kind: 'order', message: `${K}.errors.timeOrder` }
          : stepError(closeTime);
      });
    },
  );
}

/**
 * The times' required marker, outside the commit gate. The gated `required` alone puts the
 * asterisk on only after the first save.
 */
export function closureLiveRules(path: SchemaPathTree<ClosureFormValue>): void {
  metadata(path.openTime, REQUIRED, (context) => !context.valueOf(path.closedAllDay));
  metadata(path.closeTime, REQUIRED, (context) => !context.valueOf(path.closedAllDay));
}

/** A new closure: one whole day. */
export function emptyClosure(day: string): ClosureFormValue {
  return { startsOn: day, endsOn: day, closedAllDay: true, openTime: '', closeTime: '', name: '' };
}

export function closureForm(holiday: CompanyHolidayResponse): ClosureFormValue {
  return {
    startsOn: holiday.startsOn,
    endsOn: holiday.endsOn,
    closedAllDay: holiday.isClosed,
    openTime: holiday.openTime ?? '',
    closeTime: holiday.closeTime ?? '',
    name: holiday.name ?? '',
  };
}

/** A closure sends no times. An empty name is `null`. */
export function closureRequest(value: ClosureFormValue): CreateCompanyHolidayRequest {
  const name = value.name.trim();
  return {
    startsOn: value.startsOn,
    endsOn: value.endsOn,
    isClosed: value.closedAllDay,
    openTime: value.closedAllDay ? null : value.openTime,
    closeTime: value.closedAllDay ? null : value.closeTime,
    name: name === '' ? null : name,
  };
}

/** Today is one of its days. */
export function inProgress(holiday: CompanyHolidayResponse, today: string): boolean {
  return holiday.startsOn <= today && holiday.endsOn >= today;
}

/**
 * It began before today and has not ended. Its first day is history: an edit keeps it, and a
 * delete ends the range yesterday.
 */
export function hasStarted(holiday: CompanyHolidayResponse, today: string): boolean {
  return holiday.startsOn < today && holiday.endsOn >= today;
}

function stepError(time: string): { kind: string; message: string } | undefined {
  const minutes = /^\d{2}:(\d{2})$/.exec(time)?.[1];
  return minutes !== undefined && Number(minutes) % HOURS_MINUTE_STEP !== 0
    ? { kind: 'step', message: `${K}.errors.step` }
    : undefined;
}
