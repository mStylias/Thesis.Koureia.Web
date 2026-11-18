import type { Signal, WritableSignal } from '@angular/core';
import type { UrlTree } from '@angular/router';
import type { AppointmentDetailsResponse } from '@api/appointments';

/** What a new appointment starts with. Every member is a plain value the user can change. */
export interface AppointmentPrefill {
  readonly localDate?: string;
  readonly localStartTime?: string;
  readonly staffMemberId?: string;
  /** "Book again": the appointment to copy the customer, barber and services from. */
  readonly rebookId?: string;
  /** The customer the create starts on, from the customers page. */
  readonly customerId?: string;
}

/** A barber as the page knows them, for the view's swatch and the inactive mark. */
export interface PanelStaffMember {
  readonly id: string;
  readonly displayName: string;
  readonly isActive: boolean;
  /** A CSS colour, `null` when the page draws no swatches. */
  readonly swatch: string | null;
}

/**
 * What the drawer needs from the page it opens on. The calendar and the appointments grid each
 * provide one as `APPOINTMENT_PANEL_HOST`, so the drawer never imports either.
 */
export interface AppointmentPanelHost {
  /**
   * The prefill of `new`, read from the address. It must change only when the prefill does, never
   * when the page moves behind the drawer, or the form resets under the user.
   */
  readonly prefill: Signal<AppointmentPrefill>;
  /** The barbers the page knows, active or not. The form names the catalog's barbers from it. */
  readonly staff: Signal<readonly PanelStaffMember[]>;
  /** The shop's IANA time zone, for "now". */
  readonly timezone: Signal<string>;
  /** The appointment the page marks as selected, while the drawer shows it. */
  readonly selected: WritableSignal<string | null> | null;
  /** Opens another appointment in the drawer, and moves the page to its date. */
  open(id: string, localDate: string): void;
  /** Starts a create with a prefill. */
  create(prefill: AppointmentPrefill): void;
  /** Closes the drawer. */
  close(): void;
  /** The address of every appointment of the customer. `null` hides "View all". */
  customerAppointments(customerId: string): UrlTree | null;
  /**
   * A write went through. The page reloads its list and moves to the appointment's date. A create
   * also replaces `new` in the address with the id, so the back button does not reopen the form.
   */
  written(appointment: AppointmentDetailsResponse, created: boolean): void;
}
