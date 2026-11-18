import { provideTranslocoScope } from '@jsverse/transloco';

/** Lazy translation scope for the strip's labels, notes and confirmations. */
export const SAVED_VIEWS_TRANSLOCO_SCOPE = provideTranslocoScope({
  scope: 'savedViews',
  loader: {
    el: () => import('./i18n/el'),
    en: () => import('./i18n/en'),
  },
});
