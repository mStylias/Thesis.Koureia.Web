import type { InlineLoader, TranslocoScope } from '@jsverse/transloco';

export const staffTranslocoScope = {
  scope: 'managementStaff',
  loader: {
    el: () => import('./i18n/el'),
    en: () => import('./i18n/en'),
  },
} satisfies TranslocoScope;

export const staffInlineLoader = {
  'managementStaff/el': staffTranslocoScope.loader.el,
  'managementStaff/en': staffTranslocoScope.loader.en,
} satisfies InlineLoader;
