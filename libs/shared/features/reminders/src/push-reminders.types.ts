/**
 * How `enable()` ended:
 *
 * - `on` — subscribed and registered.
 * - `dismissed` — the browser question was closed without an answer. It can be asked again.
 * - `blocked` — the browser question was refused.
 * - `failed` — the subscription or the API failed. The browser subscription is removed again.
 * - `unsupported` — this browser cannot push.
 */
export type PushEnableOutcome = 'on' | 'dismissed' | 'blocked' | 'failed' | 'unsupported';

/**
 * How `sendTest()` ended:
 *
 * - `sent` — the API handed the push to the push service.
 * - `rate-limited` — the hourly test limit.
 * - `gone` — the subscription no longer exists. The state is now `off`.
 * - `failed` — anything else.
 */
export type PushTestOutcome = 'sent' | 'rate-limited' | 'gone' | 'failed';
