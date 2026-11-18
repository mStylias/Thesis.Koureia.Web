/** One row of the services grid. Every `…At` is a UTC instant. */
export interface ServiceODataResponse {
  readonly id: string;
  /** In the request's language, else the first translation. */
  readonly name: string;
  readonly description: string | null;
  readonly categoryId: string | null;
  readonly categoryName: string | null;
  /** The base price. */
  readonly price: number;
  readonly currency: string;
  /** What the customer is told. The buffers are not in it. */
  readonly durationMinutes: number;
  readonly bufferBeforeMinutes: number;
  readonly bufferAfterMinutes: number;
  /** Duration plus both buffers. */
  readonly calendarMinutes: number;
  readonly isActive: boolean;
  /** Live assignments, inactive barbers included. */
  readonly staff: readonly ServiceStaffODataViewDto[];
  /** Assignments to active barbers only. */
  readonly staffCount: number;
  /** Over active assigned barbers, own price or the base one. `null` without one. */
  readonly minPrice: number | null;
  readonly maxPrice: number | null;
  /** Active, and performed by at least one active, bookable barber. */
  readonly isBookableOnline: boolean;
  /** Appointments that are not cancelled. */
  readonly timesBooked: number;
  readonly lastBookedAt: string | null;
  readonly createdAt: string;
  readonly updatedAt: string | null;
}

export interface ServiceStaffODataViewDto {
  readonly staffMemberId: string;
  readonly displayName: string;
  readonly isActive: boolean;
  readonly customPrice: number | null;
  readonly customDurationMinutes: number | null;
}

/** One service in every language, for the drawer. */
export interface ServiceResponse {
  readonly id: string;
  readonly categoryId: string | null;
  readonly price: number;
  readonly durationMinutes: number;
  readonly bufferBeforeMinutes: number;
  readonly bufferAfterMinutes: number;
  readonly isActive: boolean;
  /** Ordered by language code. */
  readonly translations: readonly ServiceTranslationViewDto[];
  readonly staff: readonly ServiceStaffViewDto[];
  /** Appointments that are not cancelled. */
  readonly timesBooked: number;
  /** `false` once the service is on any appointment, cancelled ones included. */
  readonly canDelete: boolean;
  readonly createdAt: string;
  readonly updatedAt: string | null;
}

export interface ServiceTranslationViewDto {
  readonly languageCode: string;
  readonly name: string;
  readonly description: string | null;
}

/** A `null` own value follows the service's base value. */
export interface ServiceStaffViewDto {
  readonly staffMemberId: string;
  readonly customPrice: number | null;
  readonly customDurationMinutes: number | null;
}

/** What the services page reads once per visit. */
export interface ServiceOptionsResponse {
  readonly currency: string;
  /** Language codes, in form order. */
  readonly languages: readonly string[];
  /** Platform categories first, then the shop's own, each by sort order. */
  readonly categories: readonly ServiceCategoryResponse[];
  /** Every non-deleted staff member, inactive and non-bookable ones included. */
  readonly staffMembers: readonly ServiceOptionStaffMemberViewDto[];
}

/** A category the shop can pick. Only an owned one can be renamed or deleted. */
export interface ServiceCategoryResponse {
  readonly id: string;
  /** In the request's language, else the first translation. */
  readonly name: string;
  readonly isOwned: boolean;
  /** This shop's live services in the category. */
  readonly serviceCount: number;
  readonly translations: readonly ServiceCategoryTranslationViewDto[];
}

export interface ServiceCategoryTranslationViewDto {
  readonly languageCode: string;
  readonly name: string;
}

export interface ServiceOptionStaffMemberViewDto {
  readonly id: string;
  readonly displayName: string;
  readonly isActive: boolean;
  readonly isBookable: boolean;
}

/** The create body. A full description of the service. */
export interface CreateServiceRequest {
  readonly categoryId: string | null;
  readonly price: number;
  readonly durationMinutes: number;
  readonly bufferBeforeMinutes: number;
  readonly bufferAfterMinutes: number;
  readonly isActive: boolean;
  /** One per language. */
  readonly translations: readonly ServiceTranslationAddEditDto[];
  /** Who performs the service. Empty is legal. */
  readonly staff: readonly ServiceStaffAddEditDto[];
}

/** The edit body. A full replace: a barber left out is unassigned. */
export type UpdateServiceRequest = CreateServiceRequest;

export interface ServiceTranslationAddEditDto {
  readonly languageCode: string;
  readonly name: string;
  readonly description: string | null;
}

/** A `null` own value, or one equal to the base, follows the base value. */
export interface ServiceStaffAddEditDto {
  readonly staffMemberId: string;
  readonly customPrice: number | null;
  readonly customDurationMinutes: number | null;
}

export interface CreateServiceCategoryRequest {
  /** One per language. */
  readonly translations: readonly ServiceCategoryTranslationAddEditDto[];
}

export type UpdateServiceCategoryRequest = CreateServiceCategoryRequest;

export interface ServiceCategoryTranslationAddEditDto {
  readonly languageCode: string;
  readonly name: string;
}
