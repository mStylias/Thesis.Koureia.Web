import type { InlineLoader, TranslocoScope } from '@jsverse/transloco';

export const customersTranslocoScope = {
  scope: 'managementCustomers',
  loader: {
    el: () => import('./i18n/el'),
    en: () => import('./i18n/en'),
  },
} satisfies TranslocoScope;

export const customersInlineLoader = {
  'managementCustomers/el': customersTranslocoScope.loader.el,
  'managementCustomers/en': customersTranslocoScope.loader.en,
} satisfies InlineLoader;
