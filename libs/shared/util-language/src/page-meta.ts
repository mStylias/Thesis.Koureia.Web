import type { ActivatedRouteSnapshot } from '@angular/router';

import type { PageMeta } from './page-meta.types';

/** The route `resolve` or `data` key that carries a {@link PageMeta}. */
export const PAGE_META = 'pageMeta';

/** The {@link PageMeta} of the deepest route that has one, read from the leaf upward. */
export function readPageMeta(root: ActivatedRouteSnapshot): PageMeta | null {
  let leaf = root;
  while (leaf.firstChild !== null) leaf = leaf.firstChild;

  for (let route: ActivatedRouteSnapshot | null = leaf; route; route = route.parent) {
    const meta = route.data[PAGE_META] as PageMeta | undefined;
    if (meta !== undefined) return meta;
  }
  return null;
}
