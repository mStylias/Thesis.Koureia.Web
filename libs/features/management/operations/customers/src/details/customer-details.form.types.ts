/**
 * The drawer's form. Text members are `''` when empty, which is what the controls write, and
 * `preferredStaffMemberId` is `''` for "No preference".
 */
export interface CustomerFormValue {
  firstName: string;
  lastName: string;
  /** E.164, or `''`. */
  phoneNumber: string;
  email: string;
  note: string;
  preferredStaffMemberId: string;
}
