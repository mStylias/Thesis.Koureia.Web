import type { InlineLoader, TranslocoScope } from '@jsverse/transloco';

export const appointmentsTranslocoScope = {
  scope: 'managementAppointments',
  loader: {
    el: () => import('./i18n/el'),
    en: () => import('./i18n/en'),
  },
} satisfies TranslocoScope;

export const appointmentsInlineLoader = {
  'managementAppointments/el': appointmentsTranslocoScope.loader.el,
  'managementAppointments/en': appointmentsTranslocoScope.loader.en,
} satisfies InlineLoader;
