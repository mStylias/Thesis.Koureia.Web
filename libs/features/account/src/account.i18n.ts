import type { InlineLoader, TranslocoScope } from '@jsverse/transloco';

export const accountTranslocoScope = {
  scope: 'account',
  loader: {
    el: () => import('./i18n/el'),
    en: () => import('./i18n/en'),
  },
} satisfies TranslocoScope;

export const accountInlineLoader = {
  'account/el': accountTranslocoScope.loader.el,
  'account/en': accountTranslocoScope.loader.en,
} satisfies InlineLoader;
