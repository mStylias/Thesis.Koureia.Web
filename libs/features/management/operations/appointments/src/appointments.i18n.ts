import type { InlineLoader, TranslocoScope } from '@jsverse/transloco';

export const appointmentsGridTranslocoScope = {
  scope: 'managementAppointmentsGrid',
  loader: {
    el: () => import('./i18n/el'),
    en: () => import('./i18n/en'),
  },
} satisfies TranslocoScope;

export const appointmentsGridInlineLoader = {
  'managementAppointmentsGrid/el': appointmentsGridTranslocoScope.loader.el,
  'managementAppointmentsGrid/en': appointmentsGridTranslocoScope.loader.en,
} satisfies InlineLoader;
