import { inject } from '@angular/core';
import type { ResolveFn, Route } from '@angular/router';
import { TranslocoService } from '@jsverse/transloco';
import { loadPageSectionsDictionaries } from '@features/management-shared-page-sections';
import { loadStaffScheduleDictionaries } from '@features/management-shared-staff-schedule';
import { forkJoin, map, type Observable } from 'rxjs';

import { leaveManagementProfile } from './page/management-profile.guard';
import { profileInlineLoader } from './profile.i18n';

/** Loads the dictionaries before the page renders, so a toast never shows a raw key. */
const preloadProfileTranslations: ResolveFn<boolean> = () =>
  loadProfileDictionaries(inject(TranslocoService)).pipe(map(() => true));

/**
 * The page's dictionaries in the active language: its own, the page frame's, and the schedule
 * lib's for the Work hours card. The shell prefetches them.
 */
export function loadProfileDictionaries(transloco: TranslocoService): Observable<unknown> {
  return forkJoin([
    transloco.load(`managementProfile/${transloco.getActiveLang()}`, {
      inlineLoader: profileInlineLoader,
    }),
    loadPageSectionsDictionaries(transloco),
    loadStaffScheduleDictionaries(transloco),
  ]);
}

/**
 * The person's own profile page, as the host route wants it: no path of its own.
 *
 * No permission guard: every person who can open the workspace can open their profile.
 */
export const profileRoute: Omit<Route, 'path'> = {
  loadComponent: () => import('./page/management-profile').then((m) => m.ManagementProfile),
  resolve: { translations: preloadProfileTranslations },
  canDeactivate: [leaveManagementProfile],
};
