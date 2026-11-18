/**
 * One shop in the superadmin's shop picker, from `GET /platform/companies/odata`. Every shop that
 * is not deleted, active or not.
 */
export interface CompanyODataResponse {
  readonly id: string;
  /** In the requested language, or whichever the shop has. */
  readonly name: string;
  readonly slug: string;
  readonly isActive: boolean;
}
