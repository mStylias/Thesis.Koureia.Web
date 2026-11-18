import type { InlineLoader, TranslocoScope } from '@jsverse/transloco';

export const companyTranslocoScope = {
  scope: 'managementCompany',
  loader: {
    el: () => import('./i18n/el'),
    en: () => import('./i18n/en'),
  },
} satisfies TranslocoScope;

export const companyInlineLoader = {
  'managementCompany/el': companyTranslocoScope.loader.el,
  'managementCompany/en': companyTranslocoScope.loader.en,
} satisfies InlineLoader;
