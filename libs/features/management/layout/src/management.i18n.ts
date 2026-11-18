import type { InlineLoader, TranslocoScope } from '@jsverse/transloco';

export const managementTranslocoScope = {
  scope: 'management',
  loader: {
    el: () => import('./i18n/el'),
    en: () => import('./i18n/en'),
  },
} satisfies TranslocoScope;

export const managementInlineLoader = {
  'management/el': managementTranslocoScope.loader.el,
  'management/en': managementTranslocoScope.loader.en,
} satisfies InlineLoader;
