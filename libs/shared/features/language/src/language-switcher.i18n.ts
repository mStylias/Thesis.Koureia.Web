import type { InlineLoader, TranslocoScope } from '@jsverse/transloco';

/** Shared scope definition for the switcher and for anything that preloads it. */
export const languageTranslocoScope = {
  scope: 'language',
  loader: {
    el: () => import('./i18n/el'),
    en: () => import('./i18n/en'),
  },
} satisfies TranslocoScope;

/**
 * The scoped-loader form, needed to preload the dictionary directly.
 *
 * A route that renders the switcher in its first paint must preload this. The pipe loads the
 * scope itself and re-renders when it arrives, which is invisible in the browser and wrong on
 * the server. A server render is one shot, and an unresolved `import()` ships HTML with no
 * accessible name on the combobox.
 */
export const languageInlineLoader = {
  'language/el': languageTranslocoScope.loader.el,
  'language/en': languageTranslocoScope.loader.en,
} satisfies InlineLoader;
