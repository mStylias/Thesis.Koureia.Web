/** The walk-in that already holds an email, and the email it was refused for. */
export interface EmailOwner {
  readonly customerId: string;
  readonly email: string;
}
