import type { InlineLoader, TranslocoScope } from '@jsverse/transloco';

export const siteLayoutTranslocoScope = {
  scope: 'siteLayout',
  loader: {
    el: () => import('./i18n/el'),
    en: () => import('./i18n/en'),
  },
} satisfies TranslocoScope;

export const siteLayoutInlineLoader = {
  'siteLayout/el': siteLayoutTranslocoScope.loader.el,
  'siteLayout/en': siteLayoutTranslocoScope.loader.en,
} satisfies InlineLoader;
