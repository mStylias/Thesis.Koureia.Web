import type { BusinessHourViewDto } from '@api/appointments';

/**
 * One card of the staff page. `…At` is a UTC instant, times are shop-local `HH:mm` and dates
 * `YYYY-MM-DD`.
 */
export interface StaffMemberCardResponse {
  readonly id: string;
  readonly fullName: string;
  /** First name and last-name initial, as customers see it: `Μαρία Κ.`. */
  readonly displayName: string;
  readonly initials: string;
  readonly avatarUrl: string | null;
  readonly jobTitleCode: string | null;
  readonly isActive: boolean;
  readonly isBookable: boolean;
  /** The roles the caller can see, by name. */
  readonly roleNames: readonly string[];
  /** Active services only. */
  readonly serviceCount: number;
  readonly today: StaffTodayViewDto;
  /** Set only while a time off runs now. */
  readonly currentTimeOff: StaffTimeOffSpanViewDto | null;
  readonly nextAppointmentAt: string | null;
  /** Over published reviews, one decimal. `null` without one. */
  readonly rating: number | null;
  readonly reviewCount: number;
  /** Why customers cannot book the member online. Empty for an inactive member. */
  readonly bookingBlockers: readonly StaffBookingBlocker[];
}

/** The member's hours inside the shop's today, holidays applied. Empty on a day off. */
export interface StaffTodayViewDto {
  readonly windows: readonly StaffWindowViewDto[];
}

export interface StaffWindowViewDto {
  readonly startTime: string;
  readonly endTime: string;
}

/** Both days inclusive. */
export interface StaffTimeOffSpanViewDto {
  readonly startsOn: string;
  readonly endsOn: string;
}

export type StaffBookingBlocker = 'NOT_BOOKABLE' | 'NO_SERVICES' | 'NO_WORK_HOURS';

/** What the page reads once per visit. `dayOfWeek` is ISO, `1` Monday to `7` Sunday. */
export interface StaffOptionsResponse {
  /** IANA zone of the shop. */
  readonly timezone: string;
  readonly slotIntervalMinutes: number;
  readonly currency: string;
  readonly businessHours: readonly BusinessHourViewDto[];
  /** Job title codes, in the order the page offers them. */
  readonly jobTitles: readonly string[];
  /** The roles the caller can see: the system ones first, then the shop's. */
  readonly roles: readonly StaffRoleOptionViewDto[];
  /** Every live service, inactive ones included, in category order then by name. */
  readonly services: readonly StaffServiceOptionViewDto[];
}

export interface StaffRoleOptionViewDto {
  readonly id: string;
  readonly name: string;
  /** A platform role, named by a code the page translates. */
  readonly isSystem: boolean;
}

export interface StaffServiceOptionViewDto {
  readonly id: string;
  /** In the request's language. */
  readonly name: string;
  readonly categoryId: string | null;
  readonly categoryName: string | null;
  readonly price: number;
  readonly durationMinutes: number;
  readonly isActive: boolean;
}

/** The drawer's member. */
export interface StaffMemberResponse {
  readonly id: string;
  readonly userId: string;
  readonly firstName: string;
  readonly lastName: string;
  readonly displayName: string;
  readonly initials: string;
  readonly email: string | null;
  readonly phoneNumber: string | null;
  readonly avatarUrl: string | null;
  readonly jobTitleCode: string | null;
  readonly isBookable: boolean;
  readonly isActive: boolean;
  /** Shop-local `YYYY-MM-DD`. */
  readonly joinedAt: string;
  /** The roles the caller can see. */
  readonly roles: readonly StaffRoleViewDto[];
  readonly services: readonly StaffMemberServiceViewDto[];
  readonly workHours: readonly StaffWorkHourViewDto[];
  readonly stats: StaffStatsViewDto;
  readonly bookingBlockers: readonly StaffBookingBlocker[];
  /** The caller's own membership. */
  readonly isSelf: boolean;
  /** `false` when the member holds a permission here that the caller does not. */
  readonly canManage: boolean;
  /** `false` once the member is on any appointment, cancelled ones included, or on a review. */
  readonly canDelete: boolean;
  readonly createdAt: string;
  readonly updatedAt: string | null;
}

export interface StaffRoleViewDto {
  readonly id: string;
  readonly name: string;
}

/** A `null` own value follows the service's base value. */
export interface StaffMemberServiceViewDto {
  readonly serviceId: string;
  readonly customPrice: number | null;
  readonly customDurationMinutes: number | null;
}

export interface StaffWorkHourViewDto {
  readonly dayOfWeek: number;
  readonly startTime: string;
  readonly endTime: string;
}

/**
 * The caller's own active membership, with what their week editor needs from the shop. Times are
 * shop-local `HH:mm`, and `dayOfWeek` is ISO, `1` Monday to `7` Sunday.
 */
export interface CurrentStaffMemberResponse {
  readonly staffMemberId: string;
  readonly companyId: string;
  /** First name and last-name initial, as customers see it: `Μαρία Κ.`. */
  readonly displayName: string;
  readonly jobTitleCode: string | null;
  readonly isBookable: boolean;
  /** Sorted by day, then start. */
  readonly workHours: readonly StaffWorkHourViewDto[];
  /** The shop's IANA zone. */
  readonly timezone: string;
  readonly slotIntervalMinutes: number;
  /** Sorted by day, then opening time. */
  readonly businessHours: readonly BusinessHourViewDto[];
}

export interface StaffStatsViewDto {
  readonly completedCount: number;
  /** Pending and confirmed appointments that have not started. */
  readonly upcomingCount: number;
  readonly rating: number | null;
  readonly reviewCount: number;
}

/** The person an exact email found. No id: the add looks the address up again. */
export interface StaffCandidateResponse {
  readonly firstName: string;
  readonly lastName: string;
  readonly email: string;
}

/** What an hours or time-off write stored, and the upcoming appointments it leaves uncovered. */
export interface StaffScheduleChangeResponse {
  /** Set by a work-hours write. */
  readonly workHours: readonly StaffWorkHourViewDto[] | null;
  /** Set by a time-off write. */
  readonly timeOff: StaffTimeOffResponse | null;
  readonly conflicts: readonly StaffConflictViewDto[];
}

export interface StaffConflictViewDto {
  readonly appointmentId: string;
  readonly localDate: string;
  readonly localStartTime: string;
  readonly localEndTime: string;
  readonly customerDisplayName: string;
}

/** `endsOn` is inclusive. The times are `null` on whole days. */
export interface StaffTimeOffResponse {
  readonly id: string;
  readonly startsOn: string;
  readonly endsOn: string;
  readonly startTime: string | null;
  readonly endTime: string | null;
  readonly reason: string | null;
}

export interface StaffPhotoResponse {
  readonly avatarUrl: string | null;
}

export interface FindStaffCandidateRequest {
  readonly email: string;
}

export interface CreateStaffMemberRequest {
  readonly email: string;
  readonly jobTitleCode: string | null;
  readonly isBookable: boolean;
  /** Shop-local `YYYY-MM-DD`. Today in the shop when `null`. */
  readonly joinedAt: string | null;
  /** Needs `roles:assign` when not empty. */
  readonly roleIds: readonly string[];
  readonly services: readonly StaffServiceAddEditDto[];
  readonly workHours: readonly StaffWorkHourAddEditDto[];
}

/** A full replace. `roleIds` replaces only the roles the caller can see. */
export interface UpdateStaffMemberRequest {
  readonly jobTitleCode: string | null;
  readonly isBookable: boolean;
  readonly joinedAt: string;
  readonly roleIds: readonly string[];
}

export interface UpdateStaffServicesRequest {
  readonly services: readonly StaffServiceAddEditDto[];
}

export interface UpdateStaffWorkHoursRequest {
  readonly workHours: readonly StaffWorkHourAddEditDto[];
}

/** Shop-local dates, both inclusive. Both times `null` is whole days. */
export interface CreateStaffTimeOffRequest {
  readonly startsOn: string;
  readonly endsOn: string;
  readonly startTime: string | null;
  readonly endTime: string | null;
  readonly reason: string | null;
}

export type UpdateStaffTimeOffRequest = CreateStaffTimeOffRequest;

/** An own value equal to the base is stored as `null`. */
export interface StaffServiceAddEditDto {
  readonly serviceId: string;
  readonly customPrice: number | null;
  readonly customDurationMinutes: number | null;
}

/** ISO `dayOfWeek`, shop-local `HH:mm`. A day may have several ranges. */
export interface StaffWorkHourAddEditDto {
  readonly dayOfWeek: number;
  readonly startTime: string;
  readonly endTime: string;
}

/** The extensions of `STAFF_ALREADY_MEMBER`, on the problem body. */
export interface StaffAlreadyMemberExtensions {
  readonly staffMemberId: string;
  readonly isActive: boolean;
}
