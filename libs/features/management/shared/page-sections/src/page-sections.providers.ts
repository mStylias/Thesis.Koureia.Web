import type { Provider } from '@angular/core';

import { PAGE_SECTIONS_CONFIG, PageEditors } from './page-editors';
import type { PageSectionsConfig } from './page-editors.types';
import { PageLoading } from './page-loading';

/**
 * What a page of cards provides: the editors that a navigation asks about, and the loading state
 * that the fragment scroll waits for.
 *
 * ```ts
 * providers: [providePageSections({ discardMessage: 'managementProfile.discard.message' })]
 * ```
 */
export function providePageSections(config: PageSectionsConfig): Provider[] {
  return [{ provide: PAGE_SECTIONS_CONFIG, useValue: config }, PageEditors, PageLoading];
}
