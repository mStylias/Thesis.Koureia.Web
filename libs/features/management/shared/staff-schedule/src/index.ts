export { StaffConflicts } from './conflicts/staff-conflicts';
export { STAFF_SCHEDULE_CONTEXT } from './context/staff-schedule-context';
export { sameValue } from './form/form-values';
export { toFormRanges, weekFromShop, weekRanges } from './form/hours-draft';
export { HOURS_MINUTE_STEP, hoursRules } from './form/hours.form';
export { StaffHours } from './hours/staff-hours';
export { WeekHoursGrid } from './hours/week-hours-grid';
export {
  loadStaffScheduleDictionaries,
  staffScheduleInlineLoader,
  staffScheduleTranslocoScope,
} from './staff-schedule.i18n';
export { formatDay, formatSpan, localParts } from './staff-schedule.format';
export { StaffTimeOff } from './time-off/staff-time-off';

export type { ScheduleConflict, StaffConflictsKind } from './conflicts/staff-conflicts.types';
export type { StaffScheduleContext } from './context/staff-schedule-context.types';
export type {
  HoursDayFormValue,
  HoursFormValue,
  HoursRangeFormValue,
  HoursRangeRef,
  WeekRange,
} from './form/hours.form.types';
export type { StaffTabEditor } from './hours/staff-hours.types';
