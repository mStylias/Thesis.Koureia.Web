/*
 * Public API of `@auth/feature-verify-email`: the routed screen that proves the address a local
 * registration signed up with, and the translation scope it owns.
 */

export * from './lib.routes';

export { VerifyEmail } from './verify-email/verify-email';
export {
  verifyEmailInlineLoader,
  verifyEmailTranslocoScope,
} from './verify-email/verify-email.i18n';
