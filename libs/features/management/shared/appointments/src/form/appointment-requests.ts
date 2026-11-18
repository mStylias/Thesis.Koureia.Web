import type {
  AppointmentDetailsResponse,
  CreateAppointmentRequest,
  UpdateAppointmentRequest,
} from '@api/appointments';

import type { AppointmentPrefill } from '../host/appointment-panel-host.types';
import { emptyAppointmentForm } from './appointment.form';
import type { AppointmentFormValue } from './appointment.form.types';

/** The form of an existing appointment, as edit mode opens it. */
export function formFromAppointment(appointment: AppointmentDetailsResponse): AppointmentFormValue {
  return {
    ...emptyAppointmentForm(),
    customerId: appointment.customerId,
    serviceIds: appointment.services.map((service) => service.serviceId),
    staffMemberId: appointment.staffMemberId,
    localDate: appointment.localDate,
    localStartTime: appointment.localStartTime,
    localEndTime: appointment.localEndTime,
    endOverridden: appointment.durationOverridden,
    internalNotes: appointment.internalNotes ?? '',
  };
}

/**
 * The form of a create. "Book again" copies the customer, the barber and the services of the
 * source appointment, and the address supplies the rest.
 */
export function formFromPrefill(
  prefill: AppointmentPrefill,
  source: AppointmentDetailsResponse | null,
): AppointmentFormValue {
  return {
    ...emptyAppointmentForm(),
    customerId: source?.customerId ?? prefill.customerId ?? '',
    serviceIds: source?.services.map((service) => service.serviceId) ?? [],
    staffMemberId: source?.staffMemberId ?? prefill.staffMemberId ?? '',
    localDate: prefill.localDate ?? '',
    localStartTime: prefill.localStartTime ?? '',
  };
}

/** Whether the customer can be emailed: they have an address the form knows. */
export function customerEmail(
  value: AppointmentFormValue,
  existingEmail: string | null | undefined,
): string | null {
  if (value.customerMode === 'new') return trimToNull(value.newCustomer.email);
  return existingEmail ?? null;
}

export function createRequest(
  value: AppointmentFormValue,
  canNotify: boolean,
): CreateAppointmentRequest {
  const walkIn = value.customerMode === 'new';
  return {
    customerId: walkIn ? null : String(value.customerId),
    newCustomer: walkIn
      ? {
          firstName: value.newCustomer.firstName.trim(),
          lastName: trimToNull(value.newCustomer.lastName),
          phoneNumber: trimToNull(value.newCustomer.phoneNumber),
          email: trimToNull(value.newCustomer.email),
        }
      : null,
    staffMemberId: value.staffMemberId,
    serviceIds: value.serviceIds,
    localDate: value.localDate,
    localStartTime: value.localStartTime,
    localEndTime: value.endOverridden ? value.localEndTime : null,
    internalNotes: trimToNull(value.internalNotes),
    notifyCustomer: canNotify && value.notifyCustomer,
  };
}

/** Whether a member the customer sees differs from the appointment: the email's trigger. */
export function customerVisibleChange(
  value: AppointmentFormValue,
  appointment: AppointmentDetailsResponse,
): boolean {
  return (
    value.staffMemberId !== appointment.staffMemberId ||
    !sameServices(value.serviceIds, appointment) ||
    value.localDate !== appointment.localDate ||
    timesChanged(value, appointment)
  );
}

/**
 * The merge patch of an edit: only the members that changed. A terminal appointment sends the
 * internal note alone, the one member it accepts.
 *
 * Start and end travel together, so the server never pairs a new start with a stale end.
 */
export function updateRequest(
  value: AppointmentFormValue,
  appointment: AppointmentDetailsResponse,
  noteOnly: boolean,
  canNotify: boolean,
): UpdateAppointmentRequest {
  const internalNotes = trimToNull(value.internalNotes);
  const note = internalNotes === appointment.internalNotes ? {} : { internalNotes };
  if (noteOnly) return { ...note, notifyCustomer: false };

  return {
    ...(value.staffMemberId === appointment.staffMemberId
      ? {}
      : { staffMemberId: value.staffMemberId }),
    ...(sameServices(value.serviceIds, appointment) ? {} : { serviceIds: value.serviceIds }),
    ...(value.localDate === appointment.localDate ? {} : { localDate: value.localDate }),
    ...(timesChanged(value, appointment)
      ? {
          localStartTime: value.localStartTime,
          localEndTime: value.endOverridden ? value.localEndTime : null,
        }
      : {}),
    ...note,
    notifyCustomer: canNotify && value.notifyCustomer && customerVisibleChange(value, appointment),
  };
}

function timesChanged(
  value: AppointmentFormValue,
  appointment: AppointmentDetailsResponse,
): boolean {
  const overridden = appointment.durationOverridden;
  return (
    value.localStartTime !== appointment.localStartTime ||
    value.endOverridden !== overridden ||
    (value.endOverridden && value.localEndTime !== appointment.localEndTime)
  );
}

function sameServices(
  serviceIds: readonly string[],
  appointment: AppointmentDetailsResponse,
): boolean {
  const booked = appointment.services.map((service) => service.serviceId);
  return (
    serviceIds.length === booked.length && serviceIds.every((id, index) => id === booked[index])
  );
}

function trimToNull(text: string): string | null {
  const trimmed = text.trim();
  return trimmed.length === 0 ? null : trimmed;
}
