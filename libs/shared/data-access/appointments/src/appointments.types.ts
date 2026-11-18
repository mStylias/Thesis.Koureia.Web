/**
 * Wire shapes of the management calendar endpoints under `/api/v1/appointments`. The API resolves
 * the shop from the signed-in user. Members are the backend's, camel-cased. Dates are shop-local
 * `YYYY-MM-DD` and times shop-local `HH:mm`.
 */
import type { CustomerBlockViewDto } from '@api/customers';

/** What the calendar reads once per shop, from `GET …/calendar-options`. */
export interface CalendarOptionsResponse {
  /** IANA name, such as `Europe/Athens`. */
  readonly timezone: string;
  readonly slotIntervalMinutes: number;
  /** Ordered by weekday, then open time. A weekday can have several ranges, or none when closed. */
  readonly businessHours: readonly BusinessHourViewDto[];
  /** Every bookable staff member, active or not, ordered by display name. */
  readonly staffMembers: readonly CalendarStaffMemberViewDto[];
  /** The active categories the shop's services use, in category sort order. */
  readonly serviceCategories: readonly CalendarServiceCategoryViewDto[];
}

export interface BusinessHourViewDto {
  /** ISO: `1` is Monday, `7` is Sunday. */
  readonly dayOfWeek: number;
  readonly openTime: string;
  readonly closeTime: string;
}

export interface CalendarStaffMemberViewDto {
  readonly id: string;
  readonly displayName: string;
  readonly initials: string;
  readonly avatarUrl: string | null;
  readonly isActive: boolean;
}

export interface CalendarServiceCategoryViewDto {
  readonly id: string;
  readonly name: string;
}

/**
 * One appointment in the shop's book, from `GET …/odata`. Every status is included.
 *
 * `$select` can narrow the row to any subset of these members, `services` included.
 */
export interface AppointmentODataResponse {
  readonly id: string;
  readonly staffMemberId: string;
  readonly staffDisplayName: string;
  readonly customerId: string;
  readonly customerDisplayName: string;
  /** The shop-local day the appointment starts on. */
  readonly localDate: string;
  readonly localStartTime: string;
  /** Without the service buffers. */
  readonly localEndTime: string;
  /** `pending`, `confirmed`, `completed`, `cancelled` or `no_show`. */
  readonly status: string;
  /** Whether the customer's note or the staff's internal note is present. */
  readonly hasNotes: boolean;
  /** In booking order. */
  readonly services: readonly AppointmentServiceODataViewDto[];
  readonly totalPrice: number;
  /** ISO 4217 code. */
  readonly currency: string;
  /** An ISO instant with a `+00:00` offset, not shop-local. */
  readonly createdAt: string;
  readonly customerEmail: string | null;
  readonly customerPhoneNumber: string | null;
  readonly cancellationReason: string | null;
  /** An ISO instant with a `+00:00` offset, not shop-local. */
  readonly cancelledAt: string | null;
  readonly cancelledByDisplayName: string | null;
  /** The start as an ISO instant, for sorting and date ranges. The grid shows it in the shop zone. */
  readonly startsAt: string;
  /** The end as an ISO instant. Without the service buffers. */
  readonly endsAt: string;
  /** From the start to the end, in minutes. */
  readonly durationMinutes: number;
  /** Who booked it: the customer in the app, or the shop. */
  readonly source: AppointmentSource;
  /** An ISO instant. `null` until the first change after the booking. */
  readonly updatedAt: string | null;
  /** The customer's rating, 1 to 5, or `null` without a review. */
  readonly rating: number | null;
  /** The shop keeps a note on the customer. */
  readonly customerHasNote: boolean;
  /** The customer is blocked from online booking at this shop. */
  readonly customerIsBlocked: boolean;
  readonly customerNoShowCount: number;
}

export interface AppointmentServiceODataViewDto {
  readonly serviceId: string;
  /** In the requested language. */
  readonly name: string;
  /** `null` for an uncategorised service, which no category filter matches. */
  readonly categoryId: string | null;
  /** The booking-time snapshot. */
  readonly durationMinutes: number;
}

/**
 * One service of the shop, inactive ones included, from `GET …/services/odata`. `$search` matches
 * the folded name.
 */
export interface ServiceOptionODataResponse {
  readonly id: string;
  /** In the requested language, or whichever the service has. */
  readonly name: string;
  readonly categoryId: string | null;
  readonly isActive: boolean;
}

/**
 * Someone with at least one appointment at the shop, from `GET …/customers/odata`, for the booking
 * form's search. `$search` matches the name, the email and the phone digits. The customers page
 * reads another shape, `CustomerODataResponse` in `@api/customers`.
 */
export interface CustomerOptionODataResponse {
  readonly id: string;
  readonly displayName: string;
  /** The shop-local day of the latest appointment here. */
  readonly lastAppointmentDate: string;
  readonly email: string | null;
  /** E.164. The person's own phone once they set one, until then the one the shop typed. */
  readonly phoneNumber: string | null;
  /** `false` for a walk-in. */
  readonly hasAccount: boolean;
  readonly preferredStaffMemberId: string | null;
  /** `null` without a preferred barber. */
  readonly preferredStaffIsActive: boolean | null;
  /** Blocked from online booking at this shop. Staff can still book. */
  readonly isBlocked: boolean;
  /** The shop keeps a note on the customer. The appointment drawer shows it. */
  readonly hasNote: boolean;
}

/** One row of the per-day counts, from `GET …/odata` with `$apply`. Days with none are absent. */
export interface AppointmentDayCount {
  readonly localDate: string;
  readonly count: number;
}

/** What to read from the book: a date range and four facets. An empty facet means all. */
export interface AppointmentsQuery {
  /** Inclusive. */
  readonly from: string;
  /** Exclusive. */
  readonly to: string;
  readonly staffMemberIds: readonly string[];
  readonly customerIds: readonly string[];
  readonly statuses: readonly string[];
  readonly categoryIds: readonly string[];
}

/** One appointment as the management drawer reads it, from `GET …/{id}`. */
export interface AppointmentDetailsResponse {
  readonly id: string;
  readonly staffMemberId: string;
  readonly staffDisplayName: string;
  readonly customerId: string;
  readonly customerDisplayName: string;
  readonly customerEmail: string | null;
  /** E.164. */
  readonly customerPhoneNumber: string | null;
  readonly localDate: string;
  readonly localStartTime: string;
  /** Without the service buffers. */
  readonly localEndTime: string;
  readonly status: string;
  /** The customer's own note. Staff never write it. */
  readonly notes: string | null;
  readonly internalNotes: string | null;
  readonly totalPrice: number;
  /** ISO 4217 code. */
  readonly currency: string;
  /** An ISO instant, not shop-local. */
  readonly createdAt: string;
  readonly cancellationReason: string | null;
  /** An ISO instant, not shop-local. */
  readonly cancelledAt: string | null;
  readonly cancelledByDisplayName: string | null;
  /** In booking order. */
  readonly services: readonly AppointmentDetailsServiceViewDto[];
  /** The end was set by staff. */
  readonly durationOverridden: boolean;
  readonly source: AppointmentSource;
  /** The customer for `online`, the staff member for `staff`. */
  readonly createdByDisplayName: string;
  /** An ISO instant, `null` when never changed. */
  readonly updatedAt: string | null;
  readonly modifiedByDisplayName: string | null;
  /** `false` for a walk-in. */
  readonly customerHasAccount: boolean;
  /** The shop's note on the customer, for all their appointments. Not the customer's `notes`. */
  readonly customerNote: string | null;
  readonly customerPreferredStaffMemberId: string | null;
  readonly customerPreferredStaffDisplayName: string | null;
  /** `null` without a preferred barber. */
  readonly customerPreferredStaffIsActive: boolean | null;
  readonly customerNoShowCount: number;
  /** The block in force at this shop. Its reason is internal. */
  readonly customerBlock: CustomerBlockViewDto | null;
}

export interface AppointmentDetailsServiceViewDto {
  readonly serviceId: string;
  readonly name: string;
  readonly categoryId: string | null;
  /** The booking-time snapshot. */
  readonly durationMinutes: number;
  /** The booking-time snapshot. */
  readonly price: number;
}

/** Who booked: the customer in the app, or the shop. */
export type AppointmentSource = 'online' | 'staff';

/** What a create or an edit can choose from, from `GET …/booking-catalog`. */
export interface AppointmentCatalogResponse {
  /** ISO 4217 code. */
  readonly currency: string;
  readonly slotIntervalMinutes: number;
  readonly serviceCategories: readonly CatalogServiceCategoryViewDto[];
  readonly uncategorizedServices: readonly CatalogServiceViewDto[];
  /** Active and bookable only. */
  readonly staffMembers: readonly CatalogStaffMemberViewDto[];
}

export interface CatalogServiceCategoryViewDto {
  readonly id: string;
  readonly name: string;
  readonly services: readonly CatalogServiceViewDto[];
}

/** An active service. Price and length are the barber's, in {@link StaffServiceOfferingViewDto}. */
export interface CatalogServiceViewDto {
  readonly id: string;
  readonly name: string;
}

/** A barber's offerings. The name is in `CalendarOptionsResponse.staffMembers`. */
export interface CatalogStaffMemberViewDto {
  readonly id: string;
  readonly offerings: readonly StaffServiceOfferingViewDto[];
}

/** One service a barber performs, at that barber's price and length. */
export interface StaffServiceOfferingViewDto {
  readonly serviceId: string;
  readonly price: number;
  readonly durationMinutes: number;
}

/** The body of `POST …/check`, which changes nothing. */
export interface CheckAppointmentRequest {
  /** An edit: this appointment is not an overlap with itself. */
  readonly appointmentId: string | null;
  /** `null` for a walk-in, which skips `CUSTOMER_OVERLAP`. */
  readonly customerId: string | null;
  readonly staffMemberId: string;
  readonly serviceIds: readonly string[];
  readonly localDate: string;
  readonly localStartTime: string;
  /** `null` means computed from the services. */
  readonly localEndTime: string | null;
}

export interface AppointmentCheckResponse {
  readonly warnings: readonly AppointmentWarningViewDto[];
}

export interface AppointmentWarningViewDto {
  readonly code: AppointmentWarningCode;
  /** The other appointment, for `SLOT_TAKEN` and `CUSTOMER_OVERLAP`. */
  readonly appointment: OverlappingAppointmentViewDto | null;
}

/** The appointment a warning names. Times are shop-local `HH:mm`. */
export interface OverlappingAppointmentViewDto {
  readonly id: string;
  readonly customerDisplayName: string;
  readonly staffDisplayName: string;
  readonly localStartTime: string;
  readonly localEndTime: string;
}

/** The query of `GET …/appointments/slots`. */
export interface ListAppointmentSlotsRequest {
  readonly localDate: string;
  /** In the order performed. Empty means any one service the barber performs. */
  readonly serviceIds: readonly string[];
  /** `null` means any barber. */
  readonly staffMemberId: string | null;
  /** Hides the times close to the customer's other appointments at the shop. `null` for a walk-in. */
  readonly customerId: string | null;
}

export interface ListAppointmentDaysRequest {
  /** Shop-local `YYYY-MM-DD`, inclusive. */
  readonly from: string;
  /** Shop-local `YYYY-MM-DD`, inclusive. At most 62 days after `from`. */
  readonly to: string;
  /** In the order performed. At least one. */
  readonly serviceIds: readonly string[];
  /** `null` means any barber. */
  readonly staffMemberId: string | null;
  /** Hides the times close to the customer's other appointments at the shop. `null` for a walk-in. */
  readonly customerId: string | null;
  /** The appointment being edited, whose own time counts as free. `null` on a create. */
  readonly appointmentId: string | null;
}

/** How full each shop-local day in a range is for a staff booking. No lead time or horizon applies. */
export interface AvailableDaysResponse {
  readonly from: string;
  readonly to: string;
  readonly timezone: string;
  /** The days with at least one free time. Ascending. May be empty. */
  readonly days: readonly string[];
  /** How full each day in `days` is, in the same order. */
  readonly capacity: readonly DayCapacityViewDto[];
}

/** One day's start times for the selection. `freeSlots / totalSlots` is the free share. */
export interface DayCapacityViewDto {
  /** Shop-local `YYYY-MM-DD`. */
  readonly date: string;
  /** The start times still bookable, as `appointments/slots` lists them. At least 1. */
  readonly freeSlots: number;
  /** The start times the day offers with no appointment booked. At least `freeSlots`. */
  readonly totalSlots: number;
}

/** The free times on one shop-local day, ascending. No lead time or booking horizon applies. */
export interface DayAvailabilityResponse {
  readonly date: string;
  readonly timezone: string;
  readonly slots: readonly AvailableSlotViewDto[];
}

export interface AvailableSlotViewDto {
  /** Shop-local `HH:mm`. */
  readonly time: string;
  readonly startsAtUtc: string;
  /** The barbers free at this time for the whole selection. Never empty. */
  readonly staffMemberIds: readonly string[];
}

export type AppointmentWarningCode =
  | 'OUTSIDE_BUSINESS_HOURS'
  | 'SHOP_CLOSED'
  | 'STAFF_NOT_WORKING'
  | 'STAFF_TIME_OFF'
  | 'CUSTOMER_OVERLAP'
  | 'IN_THE_PAST'
  | 'SLOT_TAKEN';

/** The body of `POST …/appointments`. Exactly one of `customerId` and `newCustomer` is set. */
export interface CreateAppointmentRequest {
  readonly customerId: string | null;
  readonly newCustomer: NewCustomerAddDto | null;
  readonly staffMemberId: string;
  /** In the order performed. */
  readonly serviceIds: readonly string[];
  readonly localDate: string;
  readonly localStartTime: string;
  /** `null` means computed from the services. */
  readonly localEndTime: string | null;
  readonly internalNotes: string | null;
  readonly notifyCustomer: boolean;
}

/** A walk-in: a customer with no app account, created with the appointment. */
export interface NewCustomerAddDto {
  readonly firstName: string;
  readonly lastName: string | null;
  /** E.164. */
  readonly phoneNumber: string | null;
  readonly email: string | null;
}

/** The merge-patch body of `PATCH …/{id}`. An absent member is unchanged. */
export interface UpdateAppointmentRequest {
  readonly staffMemberId?: string;
  readonly serviceIds?: readonly string[];
  readonly localDate?: string;
  readonly localStartTime?: string;
  /** `null` goes back to the computed end. */
  readonly localEndTime?: string | null;
  readonly internalNotes?: string | null;
  /** Not stored. Emails only when a member the customer sees changed. */
  readonly notifyCustomer: boolean;
}

export interface ChangeAppointmentStatusRequest {
  readonly status: 'confirmed' | 'completed' | 'no_show';
}

export interface CancelAppointmentRequest {
  readonly reason: string | null;
  readonly notifyCustomer: boolean;
  /** Ignored unless the customer is notified and there is a reason. */
  readonly includeReason: boolean;
}

/** The body of `POST …/customers/account-lookup`. The address travels in the body, out of logs. */
export interface FindCustomerAccountRequest {
  readonly email: string;
}

/** Whether an account holds the address. It never says whose. */
export interface CustomerAccountLookupResponse {
  readonly hasAccount: boolean;
}
