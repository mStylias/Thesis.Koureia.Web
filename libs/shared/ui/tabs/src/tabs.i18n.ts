import { provideTranslocoScope } from '@jsverse/transloco';

/**
 * The lib's Transloco scope, shared by every component in it that renders
 * copy (`lib-tabs`' scroll affordances and `lib-tab`'s × tooltip).
 *
 * Declared once rather than repeated per component: `lib-tab` is always
 * authored inside `lib-tabs`, so it would resolve the scope up the element
 * injector anyway — but each component providing it explicitly keeps them
 * independently usable, and a shared constant keeps the loader from
 * drifting between them.
 */
export const TABS_TRANSLOCO_SCOPE = provideTranslocoScope({
  scope: 'tabs',
  loader: {
    el: () => import('./i18n/el'),
    en: () => import('./i18n/en'),
  },
});
