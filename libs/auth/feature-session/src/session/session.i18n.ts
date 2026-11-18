import type { InlineLoader, TranslocoScope } from '@jsverse/transloco';

/** Shared scope for the auth routes and the shell's session surfaces. */
export const sessionTranslocoScope = {
  scope: 'auth',
  loader: {
    el: () => import('./i18n/el'),
    en: () => import('./i18n/en'),
  },
} satisfies TranslocoScope;

/** Scoped-loader form required when preloading translations directly. */
export const sessionInlineLoader = {
  'auth/el': sessionTranslocoScope.loader.el,
  'auth/en': sessionTranslocoScope.loader.en,
} satisfies InlineLoader;
