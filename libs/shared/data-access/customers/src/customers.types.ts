/**
 * Wire shapes of `/api/v1/customers`. A visit is a completed appointment. Dates are shop-local
 * `YYYY-MM-DD`, and every `…At` is a UTC instant.
 */

/**
 * One row of the customers page, from `GET …/odata`: someone with an appointment at the shop.
 *
 * The spend members are `null`, never `0`, for a caller without `analytics:read`. Such a caller
 * must not filter or sort on them: the API refuses with `CUSTOMER_SPEND_FORBIDDEN`.
 */
export interface CustomerODataResponse {
  readonly id: string;
  readonly displayName: string;
  readonly firstName: string;
  readonly lastName: string;
  /** E.164. The person's own phone once they set one, until then the one the shop typed. */
  readonly phoneNumber: string | null;
  readonly email: string | null;
  /** `false` for an account holder, whose name, email and phone are their own. */
  readonly isWalkIn: boolean;
  readonly visitCount: number;
  readonly firstVisitDate: string | null;
  readonly lastVisitDate: string | null;
  /** Counted in the shop's zone. `null` without a visit. */
  readonly daysSinceLastVisit: number | null;
  readonly nextAppointmentAt: string | null;
  readonly upcomingCount: number;
  readonly noShowCount: number;
  readonly lastNoShowDate: string | null;
  readonly cancellationCount: number;
  readonly preferredStaffMemberId: string | null;
  readonly preferredStaffDisplayName: string | null;
  /** `null` without a preferred barber. */
  readonly preferredStaffIsActive: boolean | null;
  readonly hasNote: boolean;
  readonly isBlocked: boolean;
  /** The day of the first appointment here, of any status. */
  readonly customerSince: string;
  readonly totalSpend: number | null;
  readonly averageSpend: number | null;
}

/** One customer as the drawer opens it, from `GET …/{id}` and every write. */
export interface CustomerResponse {
  readonly id: string;
  readonly displayName: string;
  readonly firstName: string;
  readonly lastName: string;
  /** E.164. */
  readonly phoneNumber: string | null;
  readonly email: string | null;
  readonly isWalkIn: boolean;
  readonly visitCount: number;
  readonly firstVisitDate: string | null;
  readonly lastVisitDate: string | null;
  readonly daysSinceLastVisit: number | null;
  readonly nextAppointmentAt: string | null;
  readonly upcomingCount: number;
  readonly noShowCount: number;
  readonly lastNoShowDate: string | null;
  readonly cancellationCount: number;
  readonly preferredStaffMemberId: string | null;
  readonly preferredStaffDisplayName: string | null;
  readonly preferredStaffIsActive: boolean | null;
  readonly customerSince: string;
  readonly totalSpend: number | null;
  readonly averageSpend: number | null;
  readonly note: CustomerNoteViewDto | null;
  /** The block in force at this shop. Its reason is internal. */
  readonly block: CustomerBlockViewDto | null;
  /** `true` for a walk-in only. */
  readonly canEditContactDetails: boolean;
  /** `true` for a walk-in, when the caller holds `customers:merge`. */
  readonly canMerge: boolean;
}

export interface CustomerNoteViewDto {
  readonly text: string;
  readonly updatedAt: string | null;
  readonly updatedByDisplayName: string | null;
}

export interface CustomerBlockViewDto {
  readonly reason: string;
  readonly blockedAt: string;
  readonly blockedByDisplayName: string;
}

/**
 * The merge-patch body of `PATCH …/{id}`. An absent member is unchanged, and `null` clears it.
 * The contact members apply to a walk-in only.
 */
export interface UpdateCustomerRequest {
  readonly firstName?: string;
  readonly lastName?: string | null;
  /** E.164. */
  readonly phoneNumber?: string | null;
  readonly email?: string | null;
  /** An empty or blank note clears it. */
  readonly note?: string | null;
  readonly preferredStaffMemberId?: string | null;
}

export interface BlockCustomerRequest {
  readonly reason: string;
}

/** Which of the two merged walk-ins a value is taken from. */
export type CustomerMergeSource = 'Kept' | 'Removed';

/** The body of `POST …/merge`. The API copies the chosen values itself. */
export interface MergeCustomersRequest {
  readonly keptCustomerId: string;
  readonly removedCustomerId: string;
  readonly nameFrom: CustomerMergeSource;
  readonly phoneFrom: CustomerMergeSource;
  readonly emailFrom: CustomerMergeSource;
  readonly preferredStaffFrom: CustomerMergeSource;
}
