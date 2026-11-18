/** One row of the top customers table, formatted for display. */
export interface TopCustomerRow {
  /** The customer id from the axis item. */
  readonly key: string;
  /** The place from 1, in the order of the API: by spend, then by visits. */
  readonly rank: number;
  readonly name: string;
  readonly visits: string;
  readonly spend: string;
}
