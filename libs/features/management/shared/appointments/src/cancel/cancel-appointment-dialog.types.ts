/** What the cancel dialog asked for. */
export interface CancelChoice {
  readonly reason: string | null;
  readonly notifyCustomer: boolean;
  /** Only when a reason is given and the customer is notified. */
  readonly includeReason: boolean;
}
