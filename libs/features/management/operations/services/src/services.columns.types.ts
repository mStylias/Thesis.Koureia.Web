import type { ServiceCategoryResponse, ServiceOptionStaffMemberViewDto } from '@api/services';
import type { DataSource } from '@ui/data-source';

/** What the column factory reads. Plain values, so a column list is rebuilt per language. */
export interface ServiceColumnsDeps {
  /** Resolves a key of this page's scope, with parameters. */
  readonly translate: (key: string, params?: Record<string, unknown>) => string;
  /** The active language, for the price range. */
  readonly language: string;
  /** The shop's ISO 4217 code. */
  readonly currency: string;
  readonly categories: readonly ServiceCategoryResponse[];
  /** The Barbers header filter's list. */
  readonly barbers: DataSource<ServiceOptionStaffMemberViewDto>;
}
