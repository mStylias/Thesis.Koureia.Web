import type {
  AppointmentCatalogResponse,
  AvailableSlotViewDto,
  StaffServiceOfferingViewDto,
} from '@api/appointments';

import type {
  DraftLine,
  DraftPricing,
  DraftServiceOption,
  DraftTimes,
} from './appointment-draft.types';

const TIME = /^([01]\d|2[0-3]):([0-5]\d)$/;
const DAY_MINUTES = 24 * 60;

/** `HH:mm` as minutes after midnight, or `null` when it is not a time. */
export function toMinutes(time: string): number | null {
  const match = TIME.exec(time);
  return match === null ? null : Number(match[1]) * 60 + Number(match[2]);
}

/** Minutes after midnight as `HH:mm`, or `null` outside the day. */
export function fromMinutes(minutes: number): string | null {
  if (!Number.isInteger(minutes) || minutes < 0 || minutes >= DAY_MINUTES) return null;
  const hours = Math.floor(minutes / 60);
  return `${pad(hours)}:${pad(minutes % 60)}`;
}

/** `null` when the result leaves the day: an appointment never runs past midnight. */
export function addMinutes(time: string, minutes: number): string | null {
  const start = toMinutes(time);
  return start === null ? null : fromMinutes(start + minutes);
}

/** Whether `end` is a time after `start` on the same day. */
export function endsAfter(start: string, end: string): boolean {
  const from = toMinutes(start);
  const to = toMinutes(end);
  return from !== null && to !== null && to > from;
}

/** The free times of a day for one barber, or for any barber when none is chosen. */
export function freeTimes(
  slots: readonly AvailableSlotViewDto[],
  staffMemberId: string,
): readonly string[] {
  return slots
    .filter((slot) => staffMemberId === '' || slot.staffMemberIds.includes(staffMemberId))
    .map((slot) => slot.time);
}

/**
 * The services list: the catalog in category order, then the uncategorized ones, then any booked
 * service the catalog no longer offers, so an edit still shows what the appointment holds.
 */
export function serviceOptions(
  catalog: AppointmentCatalogResponse,
  booked: readonly { readonly serviceId: string; readonly name: string }[] = [],
): readonly DraftServiceOption[] {
  const options: DraftServiceOption[] = [
    ...catalog.serviceCategories.flatMap((category) =>
      category.services.map((service) => ({ ...service, category: category.name })),
    ),
    ...catalog.uncategorizedServices.map((service) => ({ ...service, category: null })),
  ];
  const known = new Set(options.map((option) => option.id));
  for (const line of booked) {
    if (known.has(line.serviceId)) continue;
    known.add(line.serviceId);
    options.push({ id: line.serviceId, name: line.name, category: null });
  }
  return options;
}

/** Whether a barber performs a service, at the price and length of their offering. */
export function offering(
  catalog: AppointmentCatalogResponse,
  staffMemberId: string,
  serviceId: string,
): StaffServiceOfferingViewDto | undefined {
  return catalog.staffMembers
    .find((member) => member.id === staffMemberId)
    ?.offerings.find((offered) => offered.serviceId === serviceId);
}

/**
 * The lines the form prices, in the order picked. Decision 17 of the spec:
 *
 * - An appointment whose start has passed is never re-priced. A line it holds keeps its booked
 *   price and length, whoever the barber is now. An added line takes the barber's offering.
 * - A future appointment is re-priced whole once its services or its barber change: every line
 *   takes the chosen barber's current offering. Left as booked, it keeps its booked lines.
 *
 * A line booked with another barber is offered only when the chosen barber performs it too.
 * Duplicates are matched one booked line each.
 */
export function draftLines(
  pricing: DraftPricing,
  staffMemberId: string,
  serviceIds: readonly string[],
): readonly DraftLine[] {
  const { catalog, booked } = pricing;
  const keep =
    booked !== null &&
    (booked.startPassed ||
      (booked.staffMemberId === staffMemberId && sameServices(booked.services, serviceIds)));
  const kept = keep ? [...booked.services] : [];
  const names = new Map(serviceOptions(catalog, booked?.services).map((s) => [s.id, s.name]));

  return serviceIds.map((serviceId): DraftLine => {
    const offered = staffMemberId === '' ? undefined : offering(catalog, staffMemberId, serviceId);
    const index = kept.findIndex((line) => line.serviceId === serviceId);
    if (index >= 0) {
      const [line] = kept.splice(index, 1);
      return {
        serviceId,
        name: line.name,
        price: line.price,
        durationMinutes: line.durationMinutes,
        offered: booked?.staffMemberId === staffMemberId || offered !== undefined,
      };
    }
    return {
      serviceId,
      name: names.get(serviceId) ?? '',
      price: offered?.price ?? 0,
      durationMinutes: offered?.durationMinutes ?? 0,
      offered: offered !== undefined,
    };
  });
}

/** The sum of the line lengths, in minutes. */
export function draftLength(lines: readonly DraftLine[]): number {
  return lines.reduce((sum, line) => sum + line.durationMinutes, 0);
}

/** The sum of the line prices. */
export function draftTotal(lines: readonly DraftLine[]): number {
  return lines.reduce((sum, line) => sum + line.price, 0);
}

/** Whether the barber can take every line: the restriction of the spec's decision 6. */
export function fitsAll(
  pricing: DraftPricing,
  staffMemberId: string,
  serviceIds: readonly string[],
): boolean {
  return draftLines(pricing, staffMemberId, serviceIds).every((line) => line.offered);
}

/**
 * The end after a change of the time fields.
 *
 * Without an override the end follows the start and the services. With one, a new start moves
 * the end by the same amount, so the length holds, and anything else keeps the end as typed.
 */
export function nextEnd(previous: DraftTimes, next: DraftTimes, length: number): string {
  if (!next.overridden) {
    return length > 0 ? (addMinutes(next.start, length) ?? '') : '';
  }
  const from = toMinutes(previous.start);
  const to = toMinutes(next.start);
  if (from !== null && to !== null && from !== to) {
    return addMinutes(next.end, to - from) ?? next.end;
  }
  return next.end;
}

/** The same services in any order, a duplicate counted each time. */
function sameServices(
  booked: readonly { readonly serviceId: string }[],
  serviceIds: readonly string[],
): boolean {
  const byId = (a: string, b: string): number => a.localeCompare(b);
  const left = booked.map((line) => line.serviceId).sort(byId);
  const right = [...serviceIds].sort(byId);
  return left.length === right.length && left.every((id, index) => id === right[index]);
}

function pad(value: number): string {
  return value.toString().padStart(2, '0');
}
