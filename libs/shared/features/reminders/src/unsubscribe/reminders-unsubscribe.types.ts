import type { EmailReminderSubscriptionResponse } from '@api/reminders';

/** What the unsubscribe page shows. A bad token and a failed read say different things. */
export type UnsubscribeView =
  | { readonly status: 'loading' }
  | { readonly status: 'ready'; readonly subscription: EmailReminderSubscriptionResponse }
  | { readonly status: 'invalid' }
  | { readonly status: 'failed' };

/** The last change made on this page, which picks the words next to the button. */
export type UnsubscribeChange = 'none' | 'stopped' | 'resumed';
