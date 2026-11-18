import type { InlineLoader, TranslocoScope } from '@jsverse/transloco';

export const profileTranslocoScope = {
  scope: 'managementProfile',
  loader: {
    el: () => import('./i18n/el'),
    en: () => import('./i18n/en'),
  },
} satisfies TranslocoScope;

export const profileInlineLoader = {
  'managementProfile/el': profileTranslocoScope.loader.el,
  'managementProfile/en': profileTranslocoScope.loader.en,
} satisfies InlineLoader;
