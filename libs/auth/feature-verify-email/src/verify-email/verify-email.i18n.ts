import type { InlineLoader, TranslocoScope } from '@jsverse/transloco';

/** Shared scope definition for the verification route and its component tree. */
export const verifyEmailTranslocoScope = {
  scope: 'verifyEmail',
  loader: {
    el: () => import('./i18n/el'),
    en: () => import('./i18n/en'),
  },
} satisfies TranslocoScope;

/** Scoped-loader form required when preloading translations directly. */
export const verifyEmailInlineLoader = {
  'verifyEmail/el': verifyEmailTranslocoScope.loader.el,
  'verifyEmail/en': verifyEmailTranslocoScope.loader.en,
} satisfies InlineLoader;
