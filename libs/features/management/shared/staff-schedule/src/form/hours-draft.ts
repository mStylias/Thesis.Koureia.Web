import type { BusinessHourViewDto } from '@api/appointments';
import type { StaffWorkHourViewDto, UpdateStaffWorkHoursRequest } from '@api/staff';
import type { FormFailure } from '@util/forms';

import type {
  HoursDayFormValue,
  HoursFormValue,
  HoursRangeFormValue,
  HoursRangeRef,
  MinuteWindow,
  WeekRange,
} from './hours.form.types';

/** ISO weekdays, Monday first, as a Greek week reads. */
export const WEEK_DAYS: readonly number[] = [1, 2, 3, 4, 5, 6, 7];

/** A new range on a day with no reference hours, so the picker has something to start from. */
export const FALLBACK_RANGE: HoursRangeFormValue = { startTime: '10:00', endTime: '18:00' };

/** Minutes since midnight of an `HH:mm`, or `null` for anything else. */
export function toMinutes(time: string): number | null {
  const match = /^(\d{2}):(\d{2})$/.exec(time);
  if (match === null) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  return hours < 24 && minutes < 60 ? hours * 60 + minutes : null;
}

/** The member's saved week. A day with ranges is a working day. */
export function weekFromHours(hours: readonly StaffWorkHourViewDto[]): HoursFormValue {
  return {
    days: WEEK_DAYS.map((dayOfWeek) => {
      const ranges = hours
        .filter((hour) => hour.dayOfWeek === dayOfWeek)
        .map((hour) => ({ startTime: hour.startTime, endTime: hour.endTime }));
      return { dayOfWeek, working: ranges.length > 0, ranges: sortRanges(ranges) };
    }),
  };
}

/** The shop's opening hours as the member's week. */
export function weekFromShop(businessHours: readonly BusinessHourViewDto[]): HoursFormValue {
  return weekFromHours(
    businessHours.map((hours) => ({
      dayOfWeek: hours.dayOfWeek,
      startTime: hours.openTime,
      endTime: hours.closeTime,
    })),
  );
}

/** The shop's windows on one weekday. Empty when it is closed. */
export function shopWindows(
  businessHours: readonly BusinessHourViewDto[],
  dayOfWeek: number,
): readonly HoursRangeFormValue[] {
  return sortRanges(
    businessHours
      .filter((hours) => hours.dayOfWeek === dayOfWeek)
      .map((hours) => ({ startTime: hours.openTime, endTime: hours.closeTime })),
  );
}

/** The ranges a day starts with when it is switched on: the given ones, else the fallback. */
export function startingRanges(
  from: readonly HoursRangeFormValue[],
  fallback: HoursRangeFormValue = FALLBACK_RANGE,
): HoursRangeFormValue[] {
  return from.length > 0 ? from.map((range) => ({ ...range })) : [{ ...fallback }];
}

/** The ranges of the nearest open day before `index`. Empty when no earlier day is open. */
export function earlierOpenRanges(
  days: readonly HoursDayFormValue[],
  index: number,
): readonly HoursRangeFormValue[] {
  for (let earlier = index - 1; earlier >= 0; earlier--) {
    const day = days.at(earlier);
    if (day?.working && day.ranges.length > 0) return day.ranges;
  }
  return [];
}

/** The range after the day's last one, for "Add range". */
export function nextRange(day: HoursDayFormValue): HoursRangeFormValue {
  const last = day.ranges.at(-1);
  const after = last === undefined ? null : toMinutes(last.endTime);
  if (after === null) return { ...FALLBACK_RANGE };
  const start = Math.min(after + 60, 23 * 60);
  return {
    startTime: fromMinutes(start),
    endTime: fromMinutes(Math.min(start + 120, 23 * 60 + 55)),
  };
}

/**
 * Whether a range lies outside every window the shop opens that day. Such a range is stored but
 * offers nothing: availability intersects the two.
 */
export function outsideShop(
  range: HoursRangeFormValue,
  shop: readonly HoursRangeFormValue[],
): boolean {
  const own = toWindow(range);
  if (own === null) return false;
  return !shop.some((open) => {
    const opening = toWindow(open);
    return opening !== null && own.start >= opening.start && own.end <= opening.end;
  });
}

/**
 * Every range of the open days, and for each one the day and range it came from. A closed day
 * gives nothing.
 */
export function weekRanges(value: HoursFormValue): {
  readonly ranges: readonly WeekRange[];
  readonly refs: readonly HoursRangeRef[];
} {
  const refs: HoursRangeRef[] = [];
  const ranges: WeekRange[] = [];
  value.days.forEach((day, dayIndex) => {
    if (!day.working) return;
    day.ranges.forEach((range, rangeIndex) => {
      refs.push({ day: dayIndex, range: rangeIndex });
      ranges.push({ dayOfWeek: day.dayOfWeek, startTime: range.startTime, endTime: range.endTime });
    });
  });
  return { ranges, refs };
}

/**
 * The write body, and for each `workHours[i]` it sends, the day and range it came from. A day off
 * sends nothing.
 */
export function hoursRequest(value: HoursFormValue): {
  readonly request: UpdateStaffWorkHoursRequest;
  readonly refs: readonly HoursRangeRef[];
} {
  const { ranges, refs } = weekRanges(value);
  return { request: { workHours: ranges.map((range) => ({ ...range })) }, refs };
}

/** Moves a refusal on `<list>[i]` of the request to the range it came from. */
export function toFormRanges(
  failure: FormFailure,
  refs: readonly HoursRangeRef[],
  list = 'workHours',
): FormFailure {
  return {
    errors: failure.errors.map((error) => {
      const path = error.path;
      const sent = path?.[1];
      if (path?.[0] !== list || typeof sent !== 'number') return error;
      const ref = refs.at(sent);
      return ref === undefined
        ? { ...error, path: undefined }
        : { ...error, path: ['days', ref.day, 'ranges', ref.range] };
    }),
  };
}

/** Whether a day has a range that overlaps an earlier one of the same day. */
export function overlapsEarlier(ranges: readonly HoursRangeFormValue[], index: number): boolean {
  const current = ranges.at(index);
  const own = current === undefined ? null : toWindow(current);
  if (own === null) return false;
  return ranges.slice(0, index).some((other) => {
    const earlier = toWindow(other);
    return earlier !== null && own.start < earlier.end && earlier.start < own.end;
  });
}

function toWindow(range: HoursRangeFormValue): MinuteWindow | null {
  const start = toMinutes(range.startTime);
  const end = toMinutes(range.endTime);
  return start === null || end === null || end <= start ? null : { start, end };
}

function sortRanges(ranges: HoursRangeFormValue[]): HoursRangeFormValue[] {
  return [...ranges].sort((a, b) => a.startTime.localeCompare(b.startTime));
}

function fromMinutes(total: number): string {
  const hours = Math.floor(total / 60);
  const minutes = total % 60;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}
