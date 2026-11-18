import type {
  AppointmentCatalogResponse,
  AppointmentDetailsServiceViewDto,
} from '@api/appointments';

/** One service line as the form prices it. */
export interface DraftLine {
  readonly serviceId: string;
  readonly name: string;
  readonly price: number;
  readonly durationMinutes: number;
  /** The barber performs it. A line that is not is refused on save. */
  readonly offered: boolean;
}

/** What prices a draft: the catalog, and the appointment being edited, if any. */
export interface DraftPricing {
  readonly catalog: AppointmentCatalogResponse;
  /** The lines as booked, and the barber they were booked with. `null` for a create. */
  readonly booked: {
    readonly staffMemberId: string;
    readonly services: readonly AppointmentDetailsServiceViewDto[];
    /** The start has passed in shop time, so nothing is re-priced. */
    readonly startPassed: boolean;
  } | null;
}

/** The time fields before and after a change, which is what decides the next end. */
export interface DraftTimes {
  readonly start: string;
  readonly end: string;
  readonly overridden: boolean;
}

/** One option of the services list: a catalog service, or a booked one no longer offered. */
export interface DraftServiceOption {
  readonly id: string;
  readonly name: string;
  /** The category name, `null` for an uncategorized service. */
  readonly category: string | null;
}
