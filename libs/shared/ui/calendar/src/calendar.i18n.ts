import { provideTranslocoScope } from '@jsverse/transloco';

/** Lazy translation scope for the calendar's chrome: labels, hints and the "+N" chip. */
export const CALENDAR_TRANSLOCO_SCOPE = provideTranslocoScope({
  scope: 'calendar',
  loader: {
    el: () => import('./i18n/el'),
    en: () => import('./i18n/en'),
  },
});
