import type { CustomerMergeSource } from '@api/customers';

/** The values a merge picks a side for. */
export type MergeField = 'name' | 'phone' | 'email' | 'preferredStaff';

/** Which side each value comes from. */
export type MergeChoices = Record<MergeField, CustomerMergeSource>;

/** One row of the second step: the value on each side. */
export interface MergeRow {
  readonly field: MergeField;
  readonly kept: string;
  readonly removed: string;
}
