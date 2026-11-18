import type { InlineLoader, TranslocoScope } from '@jsverse/transloco';

export const servicesTranslocoScope = {
  scope: 'managementServices',
  loader: {
    el: () => import('./i18n/el'),
    en: () => import('./i18n/en'),
  },
} satisfies TranslocoScope;

export const servicesInlineLoader = {
  'managementServices/el': servicesTranslocoScope.loader.el,
  'managementServices/en': servicesTranslocoScope.loader.en,
} satisfies InlineLoader;
