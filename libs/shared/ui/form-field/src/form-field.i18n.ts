import { provideTranslocoScope } from '@jsverse/transloco';

/** Lazy translation scope for the default validation messages a field falls back to. */
export const FORM_FIELD_TRANSLOCO_SCOPE = provideTranslocoScope({
  scope: 'field',
  loader: {
    el: () => import('./i18n/el'),
    en: () => import('./i18n/en'),
  },
});
