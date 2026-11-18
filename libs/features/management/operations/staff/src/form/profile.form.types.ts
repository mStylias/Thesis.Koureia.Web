/** The employment the shop edits. `jobTitleCode` is `''` for none, which is what the select writes. */
export interface ProfileFormValue {
  jobTitleCode: string;
  isBookable: boolean;
  /** Shop-local `YYYY-MM-DD`. */
  joinedAt: string;
  roleIds: string[];
}
