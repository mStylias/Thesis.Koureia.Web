/** One service, formatted for display. */
export interface ServiceItem {
  readonly id: string;
  readonly name: string;
  readonly price: string;
  readonly duration: string;
}

/** One heading and its services. `id` and `name` are `null` for the uncategorized services. */
export interface ServiceGroup {
  readonly id: string | null;
  readonly name: string | null;
  readonly services: readonly ServiceItem[];
}
