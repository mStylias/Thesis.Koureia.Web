import { provideTranslocoScope } from '@jsverse/transloco';

/** Lazy translation scope shared by the tree's fallback name and empty state. */
export const TREE_TRANSLOCO_SCOPE = provideTranslocoScope({
  scope: 'tree',
  loader: {
    el: () => import('./i18n/el'),
    en: () => import('./i18n/en'),
  },
});
