import { provideTranslocoScope } from '@jsverse/transloco';

/** Lazy translation scope for the grid's states, announcements and labels. */
export const DATAGRID_TRANSLOCO_SCOPE = provideTranslocoScope({
  scope: 'datagrid',
  loader: {
    el: () => import('./i18n/el'),
    en: () => import('./i18n/en'),
  },
});
