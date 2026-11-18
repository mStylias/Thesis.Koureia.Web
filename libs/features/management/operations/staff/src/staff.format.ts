import type { StaffWindowViewDto } from '@api/staff';
import { formatDay, localParts } from '@features/management-shared-staff-schedule';

import type { Translate } from './staff.types';

export { formatDay, localParts } from '@features/management-shared-staff-schedule';

/** `10:00–14:00, 15:00–20:00`. */
export function formatWindows(windows: readonly StaffWindowViewDto[]): string {
  return windows.map((window) => `${window.startTime}–${window.endTime}`).join(', ');
}

/** `σήμερα 14:30`, `αύριο 10:00`, or `9 Οκτ, 10:00`, all in the shop's zone. */
export function formatWhen(
  instant: string,
  timezone: string,
  now: Date,
  language: string,
  translate: Translate,
): string {
  const when = localParts(new Date(instant), timezone);
  const today = localParts(now, timezone).day;
  if (when.day === today) {
    return translate('managementStaff.when.today', { time: when.time });
  }
  if (when.day === nextDay(today)) {
    return translate('managementStaff.when.tomorrow', { time: when.time });
  }
  return `${formatDay(when.day, language, now.getFullYear())}, ${when.time}`;
}

/** The calendar day after a `YYYY-MM-DD`. */
export function nextDay(day: string): string {
  const date = new Date(`${day}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + 1);
  return date.toISOString().slice(0, 10);
}

/** A system role by its translated name, a shop's own role by the name it was given. */
export function roleLabel(name: string, isSystem: boolean, translate: Translate): string {
  if (!isSystem) return name;
  const key = `managementStaff.roleNames.${name}`;
  const label = translate(key);
  return label === key ? name : label;
}

/** A job title code's label, or "no job title". An unknown code shows as itself. */
export function jobTitleLabel(code: string | null, translate: Translate): string {
  const key = `managementStaff.jobTitles.${code ?? 'none'}`;
  const label = translate(key);
  return label === key ? (code ?? '') : label;
}
