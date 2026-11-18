import { inject } from '@angular/core';
import type { ResolveFn, Route } from '@angular/router';
import { TranslocoService } from '@jsverse/transloco';
import { loadPageSectionsDictionaries } from '@features/management-shared-page-sections';
import { loadStaffScheduleDictionaries } from '@features/management-shared-staff-schedule';
import { SYNAX_ERROR_MESSAGES } from '@synax/client';
import { forkJoin, map, type Observable } from 'rxjs';

import { companyErrorMessages } from './company.errors';
import { companyInlineLoader } from './company.i18n';
import { leaveManagementCompany } from './page/management-company.guard';

/** Loads the dictionaries before the page renders, so a toast never shows a raw key. */
const preloadCompanyTranslations: ResolveFn<boolean> = () =>
  loadCompanyDictionaries(inject(TranslocoService)).pipe(map(() => true));

/**
 * The page's dictionaries in the active language: its own, the page frame's, and the schedule
 * lib's for the week grid's day names. The shell prefetches them.
 */
export function loadCompanyDictionaries(transloco: TranslocoService): Observable<unknown> {
  return forkJoin([
    transloco.load(`managementCompany/${transloco.getActiveLang()}`, {
      inlineLoader: companyInlineLoader,
    }),
    loadPageSectionsDictionaries(transloco),
    loadStaffScheduleDictionaries(transloco),
  ]);
}

/**
 * The shop's own settings page, as the host route wants it: no path of its own.
 *
 * No permission guard: every member can read the settings, and the API checks every write.
 */
export const companyRoute: Omit<Route, 'path'> = {
  loadComponent: () => import('./page/management-company').then((m) => m.ManagementCompany),
  providers: [{ provide: SYNAX_ERROR_MESSAGES, useFactory: companyErrorMessages }],
  resolve: { translations: preloadCompanyTranslations },
  canDeactivate: [leaveManagementCompany],
};
