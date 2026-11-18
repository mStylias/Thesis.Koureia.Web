import type { StaffCandidateResponse } from '@api/staff';

/** Where the dialog is: typing the address, or confirming the person it found. */
export type AddMemberStep =
  | { readonly kind: 'email' }
  | { readonly kind: 'confirm'; readonly candidate: StaffCandidateResponse };

/**
 * The address step. `lookup`, not `email`: Signal Forms names the input after the member, and a
 * name holding "email" is what makes a browser offer saved addresses.
 */
export interface AddEmailFormValue {
  lookup: string;
}

/** The new membership. `roleId` is `''` for no role, which is what the select writes. */
export interface AddDefaultsFormValue {
  roleId: string;
  jobTitleCode: string;
  isBookable: boolean;
  copyHours: boolean;
  allServices: boolean;
}
