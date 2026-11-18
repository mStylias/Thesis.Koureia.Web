/**
 * The wire shapes of the customer's own appointments. Members are the endpoint's, camel-cased.
 *
 * Every date is `YYYY-MM-DD` and every time of day is `HH:mm`, both read in the shop's own
 * timezone. Every instant is ISO 8601 in UTC. The client never converts between the two.
 */

/** The lifecycle of an appointment, as the API spells it. */
export type AppointmentStatus = 'pending' | 'confirmed' | 'completed' | 'cancelled' | 'no_show';

/** Who cancelled an appointment. */
export type AppointmentCanceller = 'Customer' | 'Shop';

/** The two halves of the list. `Past` holds everything that is not upcoming. */
export type AppointmentPeriod = 'Upcoming' | 'Past';

/**
 * One of the customer's own appointments. Booking, reading back, listing, cancelling and moving
 * all return it.
 *
 * `canChange`, `canAddToCalendar` and `canReview` are the server's answer at the time of the read. The client never
 * works out the cutoff or the review window itself.
 */
export interface AppointmentResponse {
  readonly id: string;
  readonly companyId: string;
  readonly companySlug: string;
  readonly companyName: string;
  readonly companyLogoUrl: string | null;
  /** One line, ready to show. */
  readonly companyAddress: string;
  /** The parts of `companyAddress`, from the same translation. */
  readonly companyStreet: string;
  readonly companyNeighborhood: string | null;
  readonly companyCity: string;
  readonly companyLatitude: number;
  readonly companyLongitude: number;
  /** The number behind "Call the shop". Can be empty. */
  readonly companyPhone: string;
  readonly companyEmail: string;
  /** Always set. When Anyone was asked for, this is who the server chose. */
  readonly staffMemberId: string;
  readonly staffDisplayName: string;
  readonly startsAtUtc: string;
  readonly endsAtUtc: string;
  /** IANA, `Europe/Athens`. */
  readonly timezone: string;
  /** Shop-local, pre-rendered so the client never converts. */
  readonly localDate: string;
  readonly localTime: string;
  /** An {@link AppointmentStatus}, kept as a string so a new status does not break the read. */
  readonly status: string;
  /** Null unless cancelled. */
  readonly cancelledBy: AppointmentCanceller | null;
  readonly cancelledAtUtc: string | null;
  /** Price and duration as booked, after overrides. In the order performed. */
  readonly services: readonly AppointmentServiceViewDto[];
  readonly totalPrice: number;
  readonly currency: string;
  readonly cancellationCutoffMinutes: number;
  readonly notes: string | null;
  /** When Cancel and Change time close. Null unless the appointment is pending or confirmed. */
  readonly changeableUntilUtc: string | null;
  /** Whether cancel and move are open right now. */
  readonly canChange: boolean;
  /** Whether the appointment is active and not started yet, so the calendar note shows. */
  readonly canAddToCalendar: boolean;
  /** When "Rate this visit" closes. Null unless completed. */
  readonly reviewableUntilUtc: string | null;
  /** Whether a review can be left right now. */
  readonly canReview: boolean;
  readonly review: AppointmentReviewViewDto | null;
}

export interface AppointmentServiceViewDto {
  readonly serviceId: string;
  readonly name: string;
  readonly price: number;
  readonly durationMinutes: number;
}

/** The customer's review of one appointment. */
export interface AppointmentReviewViewDto {
  readonly id: string;
  /** Whole stars, 1 to 5. */
  readonly rating: number;
  readonly comment: string | null;
  readonly createdAt: string;
  readonly updatedAt: string | null;
}

/** One page of `GET /users/me/appointments`. */
export interface AppointmentPageResponse {
  readonly items: readonly AppointmentResponse[];
  /** From 1. */
  readonly page: number;
  readonly pageSize: number;
  readonly hasMore: boolean;
}

/** What the list is asked for. */
export interface AppointmentListQuery {
  readonly period: AppointmentPeriod;
  /** From 1. */
  readonly page: number;
  /** At most 50. */
  readonly pageSize: number;
  readonly languageCode: string;
}

/** The body of `POST /users/me/appointments/{id}/cancel`. */
export interface CancelCurrentUserAppointmentRequest {
  /** At most 500 characters. `null` when the customer gave none. */
  readonly reason: string | null;
}

/** The body of `POST /users/me/appointments/{id}/reschedule`. */
export interface RescheduleCurrentUserAppointmentRequest {
  /** The whole new selection, in the order performed. */
  readonly serviceIds: readonly string[];
  /** `null` means Anyone, which keeps the current barber whenever they are free. */
  readonly staffMemberId: string | null;
  /** Exactly the `startsAtUtc` of the chosen slot. */
  readonly startsAtUtc: string;
  /** Replaces the note. Empty clears it. */
  readonly notes: string | null;
  /** The total the customer confirmed. Any other total refuses the move. */
  readonly expectedTotalPrice: number;
}

/** The new total a refused move carries with `APPOINTMENT_PRICE_CHANGED`. */
export interface AppointmentPriceChange {
  readonly totalPrice: number;
  readonly currency: string;
}
