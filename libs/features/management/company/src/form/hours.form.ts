import { applyEach, validate, type SchemaPathTree } from '@angular/forms/signals';
import type { BusinessHourViewDto } from '@api/appointments';
import type { UpdateCompanyBusinessHoursRequest } from '@api/company';
import {
  hoursRules,
  weekRanges,
  type HoursFormValue,
  type HoursRangeFormValue,
  type HoursRangeRef,
} from '@features/management-shared-staff-schedule';

/** The API stores at most this many ranges a day. */
export const COMPANY_MAX_RANGES = 4;

/** A day switched on with no earlier open day. */
export const COMPANY_FALLBACK_RANGE: HoursRangeFormValue = { startTime: '09:00', endTime: '17:00' };

/**
 * The week grid's rules, and at most {@link COMPANY_MAX_RANGES} ranges a day. The grid offers no
 * fifth range, so the limit only catches a range the week came with.
 */
export function companyHoursRules(path: SchemaPathTree<HoursFormValue>): void {
  hoursRules(path);
  applyEach(path.days, (day) => {
    applyEach(day.ranges, (range) => {
      validate(range, (context) =>
        context.index() >= COMPANY_MAX_RANGES
          ? { kind: 'maxRanges', message: 'managementCompany.hours.tooManyRanges' }
          : undefined,
      );
    });
  });
}

/**
 * The write body, and for each `businessHours[i]` it sends, the day and range it came from. A
 * closed day sends nothing.
 */
export function companyHoursRequest(value: HoursFormValue): {
  readonly request: UpdateCompanyBusinessHoursRequest;
  readonly refs: readonly HoursRangeRef[];
} {
  const { ranges, refs } = weekRanges(value);
  return {
    request: {
      businessHours: ranges.map((range) => ({
        dayOfWeek: range.dayOfWeek,
        openTime: range.startTime,
        closeTime: range.endTime,
      })),
    },
    refs,
  };
}

/** No day of the week is open. */
export function allClosed(value: HoursFormValue): boolean {
  return value.days.every((day) => !day.working || day.ranges.length === 0);
}

/** The saved week as the view reads it: `09:00–14:30, 17:00–21:00` per ISO day. */
export function rangesByDay(hours: readonly BusinessHourViewDto[]): ReadonlyMap<number, string> {
  const days = new Map<number, string[]>();
  [...hours]
    .sort((a, b) => a.dayOfWeek - b.dayOfWeek || a.openTime.localeCompare(b.openTime))
    .forEach((hour) => {
      const ranges = days.get(hour.dayOfWeek) ?? [];
      ranges.push(`${hour.openTime}–${hour.closeTime}`);
      days.set(hour.dayOfWeek, ranges);
    });
  return new Map([...days].map(([day, ranges]) => [day, ranges.join(', ')]));
}
