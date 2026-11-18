import { InjectionToken } from '@angular/core';

import type { StaffScheduleContext } from './staff-schedule-context.types';

/**
 * The shop facts for `lib-staff-hours` and `lib-staff-time-off`. The host page provides it.
 *
 * ```ts
 * providers: [{ provide: STAFF_SCHEDULE_CONTEXT, useExisting: StaffStore }]
 * ```
 */
export const STAFF_SCHEDULE_CONTEXT = new InjectionToken<StaffScheduleContext>(
  'STAFF_SCHEDULE_CONTEXT',
);
