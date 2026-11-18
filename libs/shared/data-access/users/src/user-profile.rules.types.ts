/** The editable part of a profile, as a form edits it. An empty phone means none. */
export interface UserProfileFormValue {
  readonly firstName: string;
  readonly lastName: string;
  readonly phoneNumber: string;
}
