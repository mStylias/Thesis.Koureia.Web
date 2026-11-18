import type { AppointmentResponse, AppointmentStatus } from '@api/customer-appointments';

import type { AppointmentActionSet, StatusChip } from '../account.types';

const STATUS_TONES: Readonly<Record<AppointmentStatus, StatusChip['tone']>> = {
  pending: 'warning',
  confirmed: 'success',
  completed: 'neutral',
  cancelled: 'neutral',
  no_show: 'error',
};

function isKnownStatus(status: string): status is AppointmentStatus {
  return Object.hasOwn(STATUS_TONES, status);
}

/** The chip a status shows. A status this app does not know reads as unknown, never as a key. */
export function statusChip(status: string): StatusChip {
  return isKnownStatus(status)
    ? { labelKey: `account.status.${status}`, tone: STATUS_TONES[status] }
    : { labelKey: 'account.status.unknown', tone: 'neutral' };
}

/** Pending or confirmed. */
export function isActive(appointment: AppointmentResponse): boolean {
  return appointment.status === 'pending' || appointment.status === 'confirmed';
}

/**
 * The actions an appointment allows. The cutoff and the review window are the server's answer
 * in `canChange` and `canReview`. `now` only tells an upcoming visit from one whose time passed
 * before the shop closed it.
 */
export function appointmentActions(
  appointment: AppointmentResponse,
  now: number = Date.now(),
): AppointmentActionSet {
  if (appointment.canChange) return 'change';
  if (isActive(appointment) && Date.parse(appointment.startsAtUtc) > now) return 'call';
  if (appointment.canReview) return 'review';
  return 'past';
}

/** A `tel:` address from a number as people write it. */
export function telHref(phone: string): string {
  return `tel:${phone.replace(/[^\d+]/g, '')}`;
}
