import type { InlineLoader, TranslocoScope } from '@jsverse/transloco';

/** Shared scope definition for the splash and for anything that preloads it. */
export const loadingScreenTranslocoScope = {
  scope: 'loadingScreen',
  loader: {
    el: () => import('./i18n/el'),
    en: () => import('./i18n/en'),
  },
} satisfies TranslocoScope;

/**
 * Scoped-loader form required when preloading the dictionary directly.
 *
 * The splash covers a wait, so it must not open one of its own. The pipe loads the scope with
 * `import()` and re-renders when it arrives, which leaves the live region unnamed for the first
 * frames. Preload this, or pass `ariaLabel`, where that matters.
 */
export const loadingScreenInlineLoader = {
  'loadingScreen/el': loadingScreenTranslocoScope.loader.el,
  'loadingScreen/en': loadingScreenTranslocoScope.loader.en,
} satisfies InlineLoader;
