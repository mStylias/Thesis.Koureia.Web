import type { InlineLoader, TranslocoScope } from '@jsverse/transloco';

export const calendarTranslocoScope = {
  scope: 'managementCalendar',
  loader: {
    el: () => import('./i18n/el'),
    en: () => import('./i18n/en'),
  },
} satisfies TranslocoScope;

export const calendarInlineLoader = {
  'managementCalendar/el': calendarTranslocoScope.loader.el,
  'managementCalendar/en': calendarTranslocoScope.loader.en,
} satisfies InlineLoader;
