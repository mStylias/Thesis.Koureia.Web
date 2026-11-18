/** Whose reminders an unsubscribe link controls, and whether they are on. */
export interface EmailReminderSubscriptionResponse {
  /** For example `e•••@example.com`. The link can be forwarded, so the API masks it. */
  readonly maskedEmail: string;
  readonly emailRemindersEnabled: boolean;
  /** The person has an account, so the page can offer Settings. */
  readonly hasAccount: boolean;
}

/** The body of `POST /reminders/unsubscribe` and `POST /reminders/resubscribe`. */
export interface SetEmailRemindersByTokenRequest {
  readonly token: string;
}
