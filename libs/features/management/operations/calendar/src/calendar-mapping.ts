import type {
  AppointmentDayCount,
  AppointmentODataResponse,
  AppointmentsQuery,
  BusinessHourViewDto,
  CalendarStaffMemberViewDto,
} from '@api/appointments';
import { LucideBan, LucideNotebookPen } from '@lucide/angular';
import type {
  CalendarEvent,
  CalendarEventMark,
  CalendarHours,
  CalendarRange,
  CalendarResource,
  CalendarSwatch,
} from '@ui/calendar';
import type { DateValue, IsoWeekday } from '@ui/date-picker';

import {
  APPOINTMENT_STATUS_SPECS,
  isAppointmentStatus,
} from '@features/management-shared-appointments';
import type { CalendarAppointmentRow, CalendarEventCopy, CalendarFilters } from './calendar.types';

const SWATCH_COUNT = 6;

/**
 * The members the calendar reads from an appointment row, sent as `$select`.
 * `CalendarAppointmentRow` is built from this list, so a mapping that reads another member does
 * not compile.
 */
export const CALENDAR_APPOINTMENT_FIELDS = [
  'id',
  'staffMemberId',
  'customerId',
  'customerDisplayName',
  'localDate',
  'localStartTime',
  'localEndTime',
  'status',
  'services',
  'customerIsBlocked',
  'customerHasNote',
] as const satisfies readonly (keyof AppointmentODataResponse)[];

export function emptyFilters(): CalendarFilters {
  return { barberIds: [], customerIds: [], statuses: [], categoryIds: [] };
}

/** How many facets narrow the book. The count on the toolbar's Filters button. */
export function countActiveFilters(filters: CalendarFilters): number {
  return [filters.barberIds, filters.customerIds, filters.statuses, filters.categoryIds].filter(
    (facet) => facet.length > 0,
  ).length;
}

/** Order does not count: a saved view that lists the same barbers in another order is the same. */
export function filtersEqual(a: CalendarFilters, b: CalendarFilters): boolean {
  return (
    sameMembers(a.barberIds, b.barberIds) &&
    sameMembers(a.customerIds, b.customerIds) &&
    sameMembers(a.statuses, b.statuses) &&
    sameMembers(a.categoryIds, b.categoryIds)
  );
}

function sameMembers(a: readonly string[], b: readonly string[]): boolean {
  return a.length === b.length && a.every((value) => b.includes(value));
}

/**
 * The whole roster as calendar resources. The swatch is the index in the roster, so it holds
 * while the roster does not change, whatever the filters show.
 */
export function toCalendarResources(
  staff: readonly CalendarStaffMemberViewDto[],
): readonly CalendarResource[] {
  return staff.map((member, index) => ({
    id: member.id,
    label: member.displayName,
    initials: member.initials,
    swatch: ((index % SWATCH_COUNT) + 1) as CalendarSwatch,
  }));
}

/**
 * The resources the calendar draws: the barbers the filter names, or else every active barber
 * and every inactive one that still has an appointment on screen.
 */
export function visibleResources(
  resources: readonly CalendarResource[],
  staff: readonly CalendarStaffMemberViewDto[],
  barberIds: readonly string[],
  booked: ReadonlySet<string>,
): readonly CalendarResource[] {
  if (barberIds.length > 0) {
    return resources.filter((resource) => barberIds.includes(resource.id));
  }
  const active = new Set(staff.filter((member) => member.isActive).map((member) => member.id));
  return resources.filter((resource) => active.has(resource.id) || booked.has(resource.id));
}

/**
 * One opening range per weekday, from the earliest open to the latest close. The time grid
 * takes one range per weekday, so a split shift's break is not shaded.
 */
export function toCalendarHours(hours: readonly BusinessHourViewDto[]): readonly CalendarHours[] {
  const merged = new Map<IsoWeekday, CalendarHours>();
  for (const entry of hours) {
    if (!isIsoWeekday(entry.dayOfWeek)) continue;
    const known = merged.get(entry.dayOfWeek);
    merged.set(entry.dayOfWeek, {
      weekday: entry.dayOfWeek,
      open: known === undefined || entry.openTime < known.open ? entry.openTime : known.open,
      close: known === undefined || entry.closeTime > known.close ? entry.closeTime : known.close,
    });
  }
  return [...merged.values()].sort((a, b) => a.weekday - b.weekday);
}

/** Whether a row passes the filters. Narrows the rows held while a new query loads. */
export function matchesFilters(row: CalendarAppointmentRow, filters: CalendarFilters): boolean {
  const passes = (facet: readonly string[], value: string): boolean =>
    facet.length === 0 || facet.includes(value);
  return (
    passes(filters.barberIds, row.staffMemberId) &&
    passes(filters.customerIds, row.customerId) &&
    passes(filters.statuses, row.status) &&
    (filters.categoryIds.length === 0 ||
      row.services.some(
        (service) =>
          service.categoryId !== null && filters.categoryIds.includes(service.categoryId),
      ))
  );
}

/**
 * An appointment as a calendar event: the customer is the title, the services the subtitle and
 * the barber the resource. An unknown status keeps its code as the badge text.
 */
export function toCalendarEvent(
  row: CalendarAppointmentRow,
  copy: CalendarEventCopy,
): CalendarEvent {
  const spec = isAppointmentStatus(row.status) ? APPOINTMENT_STATUS_SPECS[row.status] : null;
  const subtitle = row.services.map((service) => service.name).join(' • ');
  const marks = customerMarks(row, copy);
  return {
    id: row.id,
    date: row.localDate,
    start: row.localStartTime,
    end: row.localEndTime,
    title: row.customerDisplayName,
    ...(subtitle === '' ? {} : { subtitle }),
    resourceId: row.staffMemberId,
    badge: { label: copy.status(row.status), tone: spec?.tone ?? 'neutral' },
    muted: spec?.muted ?? false,
    ...(marks.length === 0 ? {} : { marks }),
  };
}

/** A blocked customer and a shop note, beside the customer's name. */
function customerMarks(row: CalendarAppointmentRow, copy: CalendarEventCopy): CalendarEventMark[] {
  const marks: CalendarEventMark[] = [];
  if (row.customerIsBlocked) marks.push({ icon: LucideBan, label: copy.blocked, tone: 'error' });
  if (row.customerHasNote) marks.push({ icon: LucideNotebookPen, label: copy.note });
  return marks;
}

/** What to ask the book for a range under the filters. `range.end` is exclusive, as `to` is. */
export function toAppointmentsQuery(
  range: CalendarRange,
  filters: CalendarFilters,
): AppointmentsQuery {
  return {
    from: range.start,
    to: range.end,
    staffMemberIds: filters.barberIds,
    customerIds: filters.customerIds,
    statuses: filters.statuses,
    categoryIds: filters.categoryIds,
  };
}

export function appointmentsQueryEqual(a: AppointmentsQuery, b: AppointmentsQuery): boolean {
  return (
    a.from === b.from &&
    a.to === b.to &&
    sameMembers(a.staffMemberIds, b.staffMemberIds) &&
    sameMembers(a.customerIds, b.customerIds) &&
    sameMembers(a.statuses, b.statuses) &&
    sameMembers(a.categoryIds, b.categoryIds)
  );
}

export function toDayCounts(
  rows: readonly AppointmentDayCount[],
): Readonly<Record<DateValue, number>> {
  return Object.fromEntries(rows.map((row) => [row.localDate, row.count]));
}

function isIsoWeekday(value: number): value is IsoWeekday {
  return Number.isInteger(value) && value >= 1 && value <= 7;
}
