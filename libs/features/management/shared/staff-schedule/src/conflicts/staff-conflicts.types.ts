import type { StaffConflictViewDto } from '@api/staff';

/** Which save the conflicts came from: names the callout's title. */
export type StaffConflictsKind = 'hours' | 'timeOff';

/** One appointment a save left outside the open time. A shop-wide save names the barber too. */
export type ScheduleConflict = StaffConflictViewDto & { readonly staffMemberDisplayName?: string };
