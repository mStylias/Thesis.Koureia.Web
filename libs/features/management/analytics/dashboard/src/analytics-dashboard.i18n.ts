import type { InlineLoader, TranslocoScope } from '@jsverse/transloco';

export const dashboardTranslocoScope = {
  scope: 'managementDashboard',
  loader: {
    el: () => import('./i18n/el'),
    en: () => import('./i18n/en'),
  },
} satisfies TranslocoScope;

export const dashboardInlineLoader = {
  'managementDashboard/el': dashboardTranslocoScope.loader.el,
  'managementDashboard/en': dashboardTranslocoScope.loader.en,
} satisfies InlineLoader;
