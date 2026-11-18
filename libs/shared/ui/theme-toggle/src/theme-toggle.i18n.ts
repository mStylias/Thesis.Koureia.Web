import type { InlineLoader, TranslocoScope } from '@jsverse/transloco';

/** Shared scope definition for the toggle and for anything that preloads it. */
export const themeToggleTranslocoScope = {
  scope: 'themeToggle',
  loader: {
    el: () => import('./i18n/el'),
    en: () => import('./i18n/en'),
  },
} satisfies TranslocoScope;

/**
 * Scoped-loader form required when preloading the dictionary directly.
 *
 * A route that renders the toggle in its first paint has to preload this. The pipe loads
 * the scope on its own and re-renders when it arrives, which is invisible in the browser
 * and wrong on the server: a render is one shot, and an unresolved `import()` leaves the
 * button with an empty `aria-label` baked into the HTML.
 */
export const themeToggleInlineLoader = {
  'themeToggle/el': themeToggleTranslocoScope.loader.el,
  'themeToggle/en': themeToggleTranslocoScope.loader.en,
} satisfies InlineLoader;
