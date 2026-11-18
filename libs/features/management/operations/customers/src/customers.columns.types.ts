import type { WorkspaceStaffMemberViewDto } from '@auth/data-access';

/** What the column factory reads. Plain values, so a column list is rebuilt per language. */
export interface CustomerColumnsDeps {
  /** Resolves a key of this page's scope, with parameters. */
  readonly translate: (key: string, params?: Record<string, unknown>) => string;
  /** The active language, for days and instants. */
  readonly language: string;
  /** The shop's IANA zone, for the next appointment. */
  readonly timezone: string;
  /** Every staff member, inactive ones included: a customer can still name one. */
  readonly staff: readonly WorkspaceStaffMemberViewDto[];
  /** Whether the caller holds `analytics:read`. Without it the spend columns do not exist. */
  readonly canSeeSpend: boolean;
}
