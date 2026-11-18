/**
 * Who the caller is at work, from `GET /users/me/workspace`.
 *
 * `company` is null for a customer, a deactivated barber and a superadmin who picked no shop.
 * `permissions` are then the global codes only.
 */
export interface CurrentUserWorkspaceResponse {
  readonly company: WorkspaceCompanyViewDto | null;
  /** The caller's effective codes at `company`, sorted. */
  readonly permissions: readonly string[];
  readonly isPlatformAdmin: boolean;
  /** Every staff member at `company`, inactive included, by display name. Empty with no `company`. */
  readonly staff: readonly WorkspaceStaffMemberViewDto[];
}

/** The name is in the caller's preferred language, or whichever the shop has. */
export interface WorkspaceCompanyViewDto {
  readonly id: string;
  readonly name: string;
  /** IANA zone of the shop, such as `Europe/Athens`. `null` from an API image that does not send it. */
  readonly timezone: string | null;
}

/** One staff member of the workspace shop. */
export interface WorkspaceStaffMemberViewDto {
  readonly id: string;
  readonly displayName: string;
  readonly isActive: boolean;
}
