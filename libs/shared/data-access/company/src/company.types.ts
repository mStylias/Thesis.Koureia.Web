import type { BusinessHourViewDto } from '@api/appointments';

/**
 * The shop as the management "My company" page shows it. Name and address are in the requested
 * language, else Greek. Times are shop-local `HH:mm`, `dayOfWeek` is ISO.
 */
export interface CompanySettingsResponse {
  readonly id: string;
  readonly slug: string;
  readonly name: string;
  readonly street: string;
  readonly neighborhood: string | null;
  readonly city: string;
  readonly region: string | null;
  readonly postalCode: string;
  readonly countryCode: string;
  readonly phone: string;
  readonly email: string;
  readonly website: string | null;
  /** IANA zone of the shop. */
  readonly timezone: string;
  readonly currency: string;
  readonly logoUrl: string | null;
  /** By day, then by `openTime`. A day with none is closed. */
  readonly businessHours: readonly BusinessHourViewDto[];
  readonly bookingRules: CompanyBookingRulesResponse;
  /** The platform's support address, where an owner asks for the changes the page cannot make. */
  readonly supportEmail: string | null;
}

/** `0` in a lead time or a cancellation window means no limit. */
export interface CompanyBookingRulesResponse {
  readonly slotIntervalMinutes: number;
  readonly minLeadTimeMinutes: number;
  readonly maxAdvanceDays: number;
  readonly cancellationCutoffMinutes: number;
}

/**
 * A closure, or special hours that replace the week on those days. Dates are shop-local
 * `YYYY-MM-DD`, and `endsOn` is inclusive.
 */
export interface CompanyHolidayResponse {
  readonly id: string;
  readonly startsOn: string;
  readonly endsOn: string;
  readonly isClosed: boolean;
  /** Both `null` on a closure. */
  readonly openTime: string | null;
  readonly closeTime: string | null;
  readonly name: string | null;
}

/**
 * What an hours or holiday write stored, and the upcoming appointments now outside the open
 * time.
 */
export interface CompanyScheduleChangeResponse {
  /** Set by an hours write. */
  readonly businessHours: readonly BusinessHourViewDto[] | null;
  /** Set by a holiday create or update. */
  readonly holiday: CompanyHolidayResponse | null;
  readonly conflicts: readonly CompanyConflictViewDto[];
}

export interface CompanyConflictViewDto {
  readonly appointmentId: string;
  readonly localDate: string;
  readonly localStartTime: string;
  readonly localEndTime: string;
  readonly customerDisplayName: string;
  readonly staffMemberDisplayName: string;
}

export interface CompanyLogoResponse {
  readonly logoUrl: string | null;
}

export interface CompanyPhotoResponse {
  readonly id: string;
  readonly url: string;
  readonly width: number;
  readonly height: number;
  /** A language with no alt text is left out. */
  readonly altTexts: readonly CompanyPhotoAltTextViewDto[];
}

export interface CompanyPhotoAltTextViewDto {
  /** `el` or `en`. */
  readonly languageCode: string;
  readonly altText: string;
}

/** The whole week. An empty list closes the shop every day. */
export interface UpdateCompanyBusinessHoursRequest {
  readonly businessHours: readonly CompanyBusinessHourAddEditDto[];
}

export interface CompanyBusinessHourAddEditDto {
  readonly dayOfWeek: number;
  readonly openTime: string;
  readonly closeTime: string;
}

/** A closure sends both times `null`. */
export interface CreateCompanyHolidayRequest {
  readonly startsOn: string;
  readonly endsOn: string;
  readonly isClosed: boolean;
  readonly openTime: string | null;
  readonly closeTime: string | null;
  readonly name: string | null;
}

export type UpdateCompanyHolidayRequest = CreateCompanyHolidayRequest;

/** Minutes, except `maxAdvanceDays`. */
export interface UpdateCompanyBookingRulesRequest {
  readonly slotIntervalMinutes: number;
  readonly minLeadTimeMinutes: number;
  readonly maxAdvanceDays: number;
  readonly cancellationCutoffMinutes: number;
}

/** A language left out keeps its text. `null` or empty clears it. */
export interface UpdateCompanyPhotoRequest {
  readonly altTexts: readonly CompanyPhotoAltTextAddEditDto[];
}

export interface CompanyPhotoAltTextAddEditDto {
  readonly languageCode: string;
  readonly altText: string | null;
}

/** Every current photo id of the shop, exactly once, in the new order. */
export interface ReorderCompanyPhotosRequest {
  readonly photoIds: readonly string[];
}
