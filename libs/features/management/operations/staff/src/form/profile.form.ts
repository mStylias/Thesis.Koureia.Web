import type { StaffMemberResponse, UpdateStaffMemberRequest } from '@api/staff';
import { field, fields } from '@util/forms';

import type { ProfileFormValue } from './profile.form.types';

const K = 'managementStaff.profile';

export const PROFILE_FIELDS = fields<ProfileFormValue>({
  jobTitleCode: field({ label: `${K}.jobTitle` }),
  isBookable: field({ label: `${K}.isBookable`, hint: `${K}.isBookableHint` }),
  joinedAt: field({ label: `${K}.joinedAt`, required: `${K}.errors.joinedAtRequired` }),
  roleIds: field({ label: `${K}.roles` }),
});

/** The saved member as the form edits it. */
export function profileForm(member: StaffMemberResponse): ProfileFormValue {
  return {
    jobTitleCode: member.jobTitleCode ?? '',
    isBookable: member.isBookable,
    joinedAt: member.joinedAt,
    roleIds: member.roles.map((role) => role.id),
  };
}

/**
 * The write body. A full replace with no defaults. `roleIds` replaces only the roles the caller can
 * see, so it is always the form's list, unchanged when the caller may not edit it.
 */
export function profileRequest(value: ProfileFormValue): UpdateStaffMemberRequest {
  return {
    jobTitleCode: value.jobTitleCode === '' ? null : value.jobTitleCode,
    isBookable: value.isBookable,
    joinedAt: value.joinedAt,
    roleIds: value.roleIds,
  };
}
