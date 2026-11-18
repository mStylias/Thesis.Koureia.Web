import type { InlineLoader, TranslocoScope, TranslocoService } from '@jsverse/transloco';
import type { Observable } from 'rxjs';

export const pageSectionsTranslocoScope = {
  scope: 'managementPageSections',
  loader: {
    el: () => import('./i18n/el'),
    en: () => import('./i18n/en'),
  },
} satisfies TranslocoScope;

export const pageSectionsInlineLoader = {
  'managementPageSections/el': pageSectionsTranslocoScope.loader.el,
  'managementPageSections/en': pageSectionsTranslocoScope.loader.en,
} satisfies InlineLoader;

/**
 * The dictionary in the active language. A host page must load it before it renders: the discard
 * question is translated imperatively.
 */
export function loadPageSectionsDictionaries(transloco: TranslocoService): Observable<unknown> {
  return transloco.load(`managementPageSections/${transloco.getActiveLang()}`, {
    inlineLoader: pageSectionsInlineLoader,
  });
}
