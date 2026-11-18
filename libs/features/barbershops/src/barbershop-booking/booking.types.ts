import type { AppointmentResponse } from '@api/customer-appointments';

import type {
  AvailableSlotViewDto,
  BookableStaffMemberViewDto,
  BookingServiceViewDto,
  CompanyBookingOptionsResponse,
} from '../data/booking.api.types';

/** The steps, in the order they are walked. `shop` is decided before the stepper appears. */
export type BookingStepId = 'shop' | 'services' | 'barber' | 'when' | 'confirm';

/**
 * What the customer has chosen. The single source of truth for the flow, and the only thing
 * written to storage.
 *
 * It holds ids and shop-local strings, never resolved objects: a draft outlives the answer it
 * was formed against, so anything it stored would be a second, staler copy of the catalog.
 */
export interface BookingDraft {
  readonly slug: string;
  readonly serviceIds: readonly string[];
  /** `null` means Anyone. */
  readonly staffMemberId: string | null;
  /** Shop-local `YYYY-MM-DD`. */
  readonly date: string | null;
  /** Shop-local `HH:mm`. */
  readonly time: string | null;
  /** Echoed from the chosen slot. Never computed here. */
  readonly startsAtUtc: string | null;
  readonly notes: string;
  readonly step: BookingStepId;
  /** ISO 8601 UTC. What the six-hour expiry is measured from. */
  readonly savedAt: string;
}

/** What the page shows. `not-found` and `failed` say different things and answer differently. */
export type BookingPage =
  | { readonly status: 'found'; readonly options: CompanyBookingOptionsResponse }
  | { readonly status: 'not-found' }
  | { readonly status: 'failed' };

/** What a resume repaired, so the page can say it in one sentence. */
export type BookingRepair =
  | 'services-dropped'
  | 'services-cleared'
  | 'barber-cleared'
  | 'date-cleared'
  | 'time-cleared';

/** The outcome of reconciling a stored draft with the shop's current answer. */
export interface BookingResume {
  readonly draft: BookingDraft;
  /** Everything that had to be dropped, in the order the rules ran. */
  readonly repairs: readonly BookingRepair[];
  /** The earliest step that lost a value, or the draft's own step when nothing did. */
  readonly step: BookingStepId;
}

/** One service the customer picked, with the price and duration that apply to them. */
export interface ChosenService {
  readonly id: string;
  readonly name: string;
  readonly price: number;
  readonly durationMinutes: number;
}

/**
 * The selection's price and duration.
 *
 * `exact` is false while barbers disagree about the price and none has been chosen — the total
 * is then a floor, and the UI says `από` rather than stating a number it cannot stand behind.
 */
export interface BookingTotals {
  readonly durationMinutes: number;
  readonly price: number;
  readonly exact: boolean;
}

/**
 * How the selection summary arranges its rows.
 *
 * `stacked` is a column, for a panel or a sheet. `inline` runs the rows across one line, for
 * the wide-screen footer bar, where the height is the scarce dimension rather than the width.
 */
export type BookingSummaryLayout = 'stacked' | 'inline';

/**
 * One thing the customer chose, as the summary shows it.
 *
 * `meta` is the part that is true of the choice rather than the choice itself — a service's
 * duration and price, a day's time. It is set apart, so the name reads first.
 */
export interface BookingSummaryValue {
  readonly text: string;
  readonly meta?: string;
}

/** One row of the selection summary. A row with no `value` is waiting, not absent. */
export interface BookingSummaryRow {
  readonly id: BookingStepId;
  readonly label: string;
  /** Several values for the services row, one for the rest. Empty means waiting. */
  readonly values: readonly BookingSummaryValue[];
}

/** A barber as the barber step shows them, with this selection's totals already applied. */
export interface BarberChoice {
  readonly barber: BookableStaffMemberViewDto | null;
  /** `null` for the Anyone option, which has no single price. */
  readonly totals: BookingTotals | null;
}

/** A service and the category heading it sits under. `null` for the uncategorized group. */
export interface ServiceGroupView {
  readonly id: string | null;
  readonly name: string | null;
  readonly services: readonly BookingServiceViewDto[];
}

/** The slot list for one day, plus what the page has to say when it is empty. */
export interface DaySlots {
  readonly date: string;
  readonly slots: readonly AvailableSlotViewDto[];
}

/**
 * Which path the confirm step's button is on.
 *
 * `deciding` is its own state and not a guess at `anonymous`: the session resolves
 * asynchronously, and offering to sign in someone who is already signed in is worse than
 * holding the space for a moment.
 */
export type BookingGate = 'deciding' | 'anonymous' | 'unverified' | 'ready';

/** A move's selection priced the way the server prices it. See `rescheduleQuote`. */
export interface RescheduleQuote {
  readonly chosen: readonly ChosenService[];
  readonly totals: BookingTotals;
}

/**
 * The appointment the page is moving, from `?reschedule={id}`. `none` is an ordinary booking.
 * `unavailable` covers a missing appointment, another customer's, another shop's, and one that
 * can no longer be changed online.
 */
export type ReschedulePage =
  | { readonly status: 'none' }
  | { readonly status: 'found'; readonly appointment: AppointmentResponse }
  | { readonly status: 'unavailable'; readonly appointmentId: string };

/** The choices "Book again" arrives with, from `?services=a,b&barber=x`. */
export interface BookingSeed {
  readonly serviceIds: readonly string[];
  /** `null` is Anyone. */
  readonly staffMemberId: string | null;
}

/** One line of the move's before-and-after table. `after` is `null` until it is chosen. */
export interface RescheduleRow {
  /** A translation key. */
  readonly label: string;
  readonly before: string;
  readonly after: string | null;
  /** A translation key that names the new value instead, such as Anyone. */
  readonly afterKey?: string | null;
}
