import type { CompanyBookingOptionsResponse } from '../../data/booking.api.types';
import type { BookingDraft, BookingRepair, BookingResume, BookingStepId } from '../booking.types';
import { bookableServices, performsAll } from './booking-catalog';

/**
 * Reconciles a stored draft with what the shop offers now.
 *
 * **Degrade, never discard.** Every rule drops the smallest thing it can and keeps the rest, so
 * a customer who left a booking half-made comes back to as much of it as still exists. Clearing
 * everything because one service was deactivated is the failure mode this exists to prevent.
 *
 * Pure, and it does not know about availability: the date and time are checked against the
 * shop's horizon here, and against the day and slot lists by {@link applyDayCheck} and
 * {@link applyTimeCheck} once those answers arrive.
 *
 * `today` is the shop-local day, which is not necessarily the browser's.
 */
export function resumeDraft(
  draft: BookingDraft,
  options: CompanyBookingOptionsResponse,
  today: string,
): BookingResume {
  const repairs: BookingRepair[] = [];
  const offered = new Set(bookableServices(options).map((service) => service.id));

  let serviceIds = draft.serviceIds.filter((id) => offered.has(id));
  if (serviceIds.length !== draft.serviceIds.length) {
    repairs.push(serviceIds.length === 0 ? 'services-cleared' : 'services-dropped');
  }
  // Nothing left to book means nothing downstream can survive either: a barber performs a set
  // that no longer exists, and a slot was measured for a duration nobody asked for.
  if (serviceIds.length === 0) {
    serviceIds = [];
    return {
      draft: {
        ...draft,
        serviceIds,
        staffMemberId: null,
        date: null,
        time: null,
        startsAtUtc: null,
      },
      repairs,
      step: 'services',
    };
  }

  let staffMemberId = draft.staffMemberId;
  if (staffMemberId !== null) {
    const barber = options.barbers.find((candidate) => candidate.id === staffMemberId);
    if (barber === undefined || !performsAll(barber, serviceIds)) {
      staffMemberId = null;
      repairs.push('barber-cleared');
    }
  }

  let date = draft.date;
  let time = draft.time;
  let startsAtUtc = draft.startsAtUtc;
  if (date !== null && !withinHorizon(date, today, options.maxAdvanceDays)) {
    date = null;
    time = null;
    startsAtUtc = null;
    repairs.push('date-cleared');
  }
  // A time with no instant behind it cannot be submitted, so it is not a choice.
  if (time !== null && startsAtUtc === null) {
    time = null;
    repairs.push('time-cleared');
  }

  const repaired: BookingDraft = { ...draft, serviceIds, staffMemberId, date, time, startsAtUtc };
  return { draft: repaired, repairs, step: landingStep(repaired, repairs, draft.step) };
}

/** Drops the day, and everything under it, when it is no longer offered. */
export function applyDayCheck(
  resume: BookingResume,
  availableDays: readonly string[],
): BookingResume {
  const { draft } = resume;
  if (draft.date === null || availableDays.includes(draft.date)) return resume;

  const repaired: BookingDraft = { ...draft, date: null, time: null, startsAtUtc: null };
  const repairs: readonly BookingRepair[] = [...resume.repairs, 'date-cleared'];
  return { draft: repaired, repairs, step: landingStep(repaired, repairs, resume.step) };
}

/** Drops the time and keeps the day. A day that still has other slots is still a choice made. */
export function applyTimeCheck(resume: BookingResume, slotTimes: readonly string[]): BookingResume {
  const { draft } = resume;
  if (draft.time === null || slotTimes.includes(draft.time)) return resume;

  const repaired: BookingDraft = { ...draft, time: null, startsAtUtc: null };
  const repairs: readonly BookingRepair[] = [...resume.repairs, 'time-cleared'];
  return { draft: repaired, repairs, step: landingStep(repaired, repairs, resume.step) };
}

/**
 * Where to land: the earliest step that lost a value, or the draft's own step when nothing did.
 *
 * A step the draft has not reached yet is never landed on — a draft saved at `services` that
 * loses nothing stays at `services`, whatever is empty after it.
 */
function landingStep(
  draft: BookingDraft,
  repairs: readonly BookingRepair[],
  savedStep: BookingStepId,
): BookingStepId {
  if (repairs.includes('services-cleared') || repairs.includes('services-dropped')) {
    return 'services';
  }
  if (repairs.includes('barber-cleared')) return 'barber';
  if (repairs.includes('date-cleared') || repairs.includes('time-cleared')) return 'when';

  // Nothing was repaired, but a draft can still be missing what its step assumes — a saved
  // `confirm` with no time never happens through the UI and would be a dead end if it did.
  if (savedStep === 'confirm' && draft.startsAtUtc === null) return 'when';
  return savedStep;
}

function withinHorizon(date: string, today: string, maxAdvanceDays: number): boolean {
  if (date < today) return false;

  const start = Date.parse(`${today}T00:00:00Z`);
  const chosen = Date.parse(`${date}T00:00:00Z`);
  if (!Number.isFinite(start) || !Number.isFinite(chosen)) return false;

  const days = Math.round((chosen - start) / 86_400_000);
  return days <= maxAdvanceDays;
}
