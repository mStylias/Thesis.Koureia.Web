import { provideTranslocoScope } from '@jsverse/transloco';

/**
 * The lib's Transloco scope, shared by the stack and the toasts in it: the
 * list needs a landmark name and every close button needs an accessible one,
 * and neither can be the consumer's duty — toasts are fired from code that
 * only supplies a message.
 *
 * `lib-toast` is always created by `lib-toaster`, so it would resolve the
 * scope up the element injector anyway; providing it on both keeps a toast
 * renderable on its own and keeps the loader from drifting.
 */
export const TOASTER_TRANSLOCO_SCOPE = provideTranslocoScope({
  scope: 'toaster',
  loader: {
    el: () => import('./i18n/el'),
    en: () => import('./i18n/en'),
  },
});
