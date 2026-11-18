import type { ParamMap } from '@angular/router';
import { isCanonicalDate } from '@ui/date-picker';

import type { AppointmentPrefill } from './appointment-panel-host.types';

const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

/** The prefill `new` carries in the query. A malformed member is dropped, never passed on. */
export function readPrefill(params: ParamMap): AppointmentPrefill {
  const date = params.get('slotDate');
  const time = params.get('slotTime');
  const barber = params.get('barberId');
  const rebook = params.get('rebook');
  // Not `customer`: the appointments grid reads that one as its customer view.
  const customer = params.get('customerId');
  return {
    ...(date !== null && isCanonicalDate(date) ? { localDate: date } : {}),
    ...(time !== null && TIME.test(time) ? { localStartTime: time } : {}),
    ...(barber !== null && barber !== '' ? { staffMemberId: barber } : {}),
    ...(rebook !== null && rebook !== '' ? { rebookId: rebook } : {}),
    ...(customer !== null && customer !== '' ? { customerId: customer } : {}),
  };
}

/** A prefill as query parameters, the inverse of {@link readPrefill}. */
export function prefillParams(prefill: AppointmentPrefill): Record<string, string> {
  return {
    ...(prefill.localDate === undefined ? {} : { slotDate: prefill.localDate }),
    ...(prefill.localStartTime === undefined ? {} : { slotTime: prefill.localStartTime }),
    ...(prefill.staffMemberId === undefined ? {} : { barberId: prefill.staffMemberId }),
    ...(prefill.rebookId === undefined ? {} : { rebook: prefill.rebookId }),
    ...(prefill.customerId === undefined ? {} : { customerId: prefill.customerId }),
  };
}

/** Member by member, so a new query object with the same prefill is not a change. */
export function prefillEqual(a: AppointmentPrefill, b: AppointmentPrefill): boolean {
  return (
    a.localDate === b.localDate &&
    a.localStartTime === b.localStartTime &&
    a.staffMemberId === b.staffMemberId &&
    a.rebookId === b.rebookId &&
    a.customerId === b.customerId
  );
}
