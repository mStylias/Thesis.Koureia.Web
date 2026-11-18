import type {
  CreateStaffMemberRequest,
  StaffOptionsResponse,
  StaffRoleOptionViewDto,
  StaffServiceAddEditDto,
  StaffWorkHourAddEditDto,
} from '@api/staff';

import type { AddDefaultsFormValue } from './add-member-dialog.types';

/** The system role a barber gets by default. */
const DEFAULT_ROLE_NAME = 'staff';

/** The job title a new member starts with, when the shop offers it. */
const DEFAULT_JOB_TITLE = 'barber';

/** The confirm step's starting values. */
export function defaultsFor(
  options: StaffOptionsResponse | null,
  canAssignRoles: boolean,
): AddDefaultsFormValue {
  const jobTitles = options?.jobTitles ?? [];
  return {
    roleId: canAssignRoles ? defaultRoleId(options?.roles ?? []) : '',
    jobTitleCode: jobTitles.includes(DEFAULT_JOB_TITLE) ? DEFAULT_JOB_TITLE : (jobTitles[0] ?? ''),
    isBookable: true,
    copyHours: true,
    allServices: true,
  };
}

export function defaultRoleId(roles: readonly StaffRoleOptionViewDto[]): string {
  return roles.find((role) => role.isSystem && role.name === DEFAULT_ROLE_NAME)?.id ?? '';
}

/** The shop's opening hours, one range per opening. */
export function workHoursFromShop(options: StaffOptionsResponse | null): StaffWorkHourAddEditDto[] {
  return (options?.businessHours ?? []).map((hours) => ({
    dayOfWeek: hours.dayOfWeek,
    startTime: hours.openTime,
    endTime: hours.closeTime,
  }));
}

/** Every active service, at its base price and duration. */
export function activeServices(options: StaffOptionsResponse | null): StaffServiceAddEditDto[] {
  return (options?.services ?? [])
    .filter((service) => service.isActive)
    .map((service) => ({ serviceId: service.id, customPrice: null, customDurationMinutes: null }));
}

/**
 * The add. The client sends the hours and the services, the API invents neither. A member who
 * takes no appointments gets neither, and a caller who cannot assign roles sends none.
 */
export function createRequest(
  email: string,
  value: AddDefaultsFormValue,
  options: StaffOptionsResponse | null,
  canAssignRoles: boolean,
): CreateStaffMemberRequest {
  const bookable = value.isBookable;
  return {
    email: email.trim(),
    jobTitleCode: value.jobTitleCode === '' ? null : value.jobTitleCode,
    isBookable: bookable,
    joinedAt: null,
    roleIds: canAssignRoles && value.roleId !== '' ? [value.roleId] : [],
    services: bookable && value.allServices ? activeServices(options) : [],
    workHours: bookable && value.copyHours ? workHoursFromShop(options) : [],
  };
}
