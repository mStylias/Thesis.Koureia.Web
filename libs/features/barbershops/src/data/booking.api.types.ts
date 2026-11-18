export type { AppointmentResponse, AppointmentServiceViewDto } from '@api/customer-appointments';

/**
 * The wire shapes of the booking flow. Members are the endpoint's, camel-cased.
 *
 * Every date is `YYYY-MM-DD` and every time of day is `HH:mm`, both read in the shop's own
 * timezone. Every instant is ISO 8601 in UTC. **The page never converts between the two** —
 * it echoes back the `startsAtUtc` the API gave it, which is what keeps DST out of the client.
 */

/**
 * Everything the stepper needs to render the service and barber steps, from
 * `GET /api/v1/companies/{slug}/booking-options`.
 */
export interface CompanyBookingOptionsResponse {
  /** For `POST /users/me/appointments`. Never part of a URL. */
  readonly companyId: string;
  readonly slug: string;
  readonly name: string;
  readonly logoUrl: string | null;
  /** IANA, `Europe/Athens`. Every date and time below is read in it. */
  readonly timezone: string;
  /** ISO 4217. Every price below is in it. */
  readonly currency: string;
  readonly slotIntervalMinutes: number;
  /** How far ahead of now the first bookable slot is. */
  readonly minLeadTimeMinutes: number;
  /** How many days ahead the calendar opens. */
  readonly maxAdvanceDays: number;
  /** Free cancellation up to this many minutes before the start. `0` means no free window. */
  readonly cancellationCutoffMinutes: number;
  /** In display order. A category with no bookable service is left out. */
  readonly serviceCategories: readonly BookingServiceCategoryViewDto[];
  /** Bookable services with no active category. */
  readonly uncategorizedServices: readonly BookingServiceViewDto[];
  /** Bookable, active staff. Never empty when any service is listed. */
  readonly barbers: readonly BookableStaffMemberViewDto[];
}

export interface BookingServiceCategoryViewDto {
  readonly id: string;
  readonly name: string;
  /** Never empty. */
  readonly services: readonly BookingServiceViewDto[];
}

export interface BookingServiceViewDto {
  readonly id: string;
  readonly name: string;
  readonly description: string | null;
  /** The base price, before any per-barber override. */
  readonly price: number;
  /** The base duration in minutes, without buffers. What the customer is told. */
  readonly durationMinutes: number;
  /** The barbers who perform it. Never empty — a service nobody performs is left out. */
  readonly staffMemberIds: readonly string[];
}

export interface BookableStaffMemberViewDto {
  readonly id: string;
  /** First name and last-name initial, `Γιώργος Π.`. */
  readonly displayName: string;
  /** `ΓΠ`. What the avatar shows without a photo. */
  readonly initials: string;
  readonly avatarUrl: string | null;
  /** One entry per service this barber performs, with overrides already applied. */
  readonly offerings: readonly StaffServiceOfferingViewDto[];
}

export interface StaffServiceOfferingViewDto {
  readonly serviceId: string;
  readonly price: number;
  readonly durationMinutes: number;
}

/**
 * Which days can take the selection, from
 * `GET /api/v1/companies/{slug}/availability/days`. Every day not listed is disabled in the
 * calendar.
 */
export interface AvailableDaysResponse {
  readonly from: string;
  readonly to: string;
  readonly timezone: string;
  /** Shop-local days with at least one slot that fits. Ascending. May be empty. */
  readonly days: readonly string[];
  /** How full each day in `days` is, in the same order. Drives the calendar's tints. */
  readonly capacity: readonly DayCapacityViewDto[];
}

/** One day's start times for the selection. `freeSlots / totalSlots` is the free share. */
export interface DayCapacityViewDto {
  /** Shop-local `YYYY-MM-DD`. */
  readonly date: string;
  /** The start times still bookable, as `availability/slots` lists them. At least 1. */
  readonly freeSlots: number;
  /** The start times the day offers with no appointment booked. At least `freeSlots`. */
  readonly totalSlots: number;
}

/**
 * The bookable times on one day, from
 * `GET /api/v1/companies/{slug}/availability/slots`.
 */
export interface DayAvailabilityResponse {
  readonly date: string;
  readonly timezone: string;
  /** Ascending by time. May be empty. */
  readonly slots: readonly AvailableSlotViewDto[];
}

export interface AvailableSlotViewDto {
  /** Shop-local `HH:mm`. What the customer sees and what the picker binds to. */
  readonly time: string;
  /** Sent back verbatim on submit. The client never computes this. */
  readonly startsAtUtc: string;
  /** Who is free at this instant for the whole selection. Never empty. */
  readonly staffMemberIds: readonly string[];
}

/** The body of `POST /api/v1/users/me/appointments`. */
export interface CreateAppointmentRequest {
  readonly companyId: string;
  /** In the order they are performed. At least one. */
  readonly serviceIds: readonly string[];
  /** `null` means Anyone — the server chooses. */
  readonly staffMemberId: string | null;
  /** Exactly the `startsAtUtc` of the chosen slot. */
  readonly startsAtUtc: string;
  /** The note for the barber. `null` when empty. */
  readonly notes: string | null;
  /** `el` or `en`. The language of the confirmation email. */
  readonly languageCode: string;
}

/** What the caller asks `availability/days` and `availability/slots` about. */
export interface AvailabilityQuery {
  readonly slug: string;
  /** In the order they are performed. At least one. */
  readonly serviceIds: readonly string[];
  /** `null` means Anyone. */
  readonly staffMemberId: string | null;
}

/**
 * Whether the signed-in person can book this shop online, from
 * `GET /users/me/booking-access/{slug}`. It never says why not.
 */
export interface BookingAccessResponse {
  readonly canBookOnline: boolean;
  /** The shop's number, for the "call the shop" notice. Can be empty. */
  readonly shopPhone: string;
}
