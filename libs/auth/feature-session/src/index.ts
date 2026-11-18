/*
 * Public API of `@auth/feature-session`: the way into a session, what it still owes, the way it
 * ends, and the `auth` translation scope they share.
 */

export { AuthEntry } from './session/auth-entry/auth-entry';
export { EmailUnverified } from './session/email-unverified/email-unverified';
export { SessionExpired } from './session/session-expired/session-expired';
export { sessionInlineLoader, sessionTranslocoScope } from './session/session.i18n';
