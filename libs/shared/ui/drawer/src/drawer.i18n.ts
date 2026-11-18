import type { InlineLoader, TranslocoScope } from '@jsverse/transloco';

/** Shared scope definition for the drawer and for anything that preloads it. */
export const drawerTranslocoScope = {
  scope: 'drawer',
  loader: {
    el: () => import('./i18n/el'),
    en: () => import('./i18n/en'),
  },
} satisfies TranslocoScope;

/**
 * Scoped-loader form required when preloading the dictionary directly.
 *
 * A server-rendered route that puts a `<lib-drawer>` in its markup has to preload this,
 * **even when every string it passes the drawer is its own**. A `| transloco` in a binding
 * written on the `<lib-drawer>` element resolves its scope from that element's injector, so
 * it waits on the drawer's chunk before it emits anything at all — and a server render does
 * not wait. The result is a closed dialog with an unnamed close button in the shipped HTML.
 */
export const drawerInlineLoader = {
  'drawer/el': drawerTranslocoScope.loader.el,
  'drawer/en': drawerTranslocoScope.loader.en,
} satisfies InlineLoader;
