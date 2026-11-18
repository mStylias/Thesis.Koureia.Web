import type { HttpError } from '@synax/client/core';

import type { StaffAlreadyMemberExtensions } from './staff.types';

/** The refusals of this API that a page branches on. */
export const StaffErrorCodes = {
  /** `currentMember()`: the caller has no active membership in any shop. */
  NotStaffMember: 'USER_NOT_STAFF_MEMBER',
} as const;

/** The member an add or a lookup found on this team already, from the problem's extensions. */
export function alreadyMemberOf(error: HttpError): StaffAlreadyMemberExtensions | null {
  if (error.errorCode !== 'STAFF_ALREADY_MEMBER') return null;
  const body = asRecord(error.raw);
  const staffMemberId = body?.['staffMemberId'];
  const isActive = body?.['isActive'];
  return typeof staffMemberId === 'string' && typeof isActive === 'boolean'
    ? { staffMemberId, isActive }
    : null;
}

/** How many bookings a refused deactivation still has ahead. `null` when the body lacks it. */
export function upcomingCountOf(error: HttpError): number | null {
  if (error.errorCode !== 'STAFF_HAS_UPCOMING_APPOINTMENTS') return null;
  const count = asRecord(error.raw)?.['count'];
  return typeof count === 'number' ? count : null;
}

// `raw` is the body as received: a parsed object, or the JSON text of one.
function asRecord(raw: unknown): Readonly<Record<string, unknown>> | null {
  if (typeof raw === 'string') {
    try {
      return asRecord(JSON.parse(raw) as unknown);
    } catch {
      return null;
    }
  }
  return typeof raw === 'object' && raw !== null ? (raw as Record<string, unknown>) : null;
}
