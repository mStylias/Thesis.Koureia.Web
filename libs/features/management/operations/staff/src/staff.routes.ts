import { inject } from '@angular/core';
import { ResolveFn, Route } from '@angular/router';
import { TranslocoService } from '@jsverse/transloco';
import { loadStaffScheduleDictionaries } from '@features/management-shared-staff-schedule';
import { SYNAX_ERROR_MESSAGES } from '@synax/client';
import { forkJoin, map, type Observable } from 'rxjs';

import { StaffMemberDetails } from './details/staff-member-details';
import { leaveStaffMemberDetails } from './details/staff-member-details.guard';
import { StaffList } from './list/staff-list';
import { staffErrorMessages } from './staff.errors';
import { staffInlineLoader } from './staff.i18n';

/** The dictionaries before the page renders: labels and messages are translated imperatively. */
const preloadTranslations: ResolveFn<boolean> = () =>
  loadStaffDictionaries(inject(TranslocoService)).pipe(map(() => true));

/**
 * The page's dictionaries in the active language: its own, and the drawer's hours and time off.
 * The shell prefetches them.
 */
export function loadStaffDictionaries(transloco: TranslocoService): Observable<unknown> {
  return forkJoin([
    transloco.load(`managementStaff/${transloco.getActiveLang()}`, {
      inlineLoader: staffInlineLoader,
    }),
    loadStaffScheduleDictionaries(transloco),
  ]);
}

/** The staff screen, as the host route wants it: no path of its own. */
export const staffRoute: Omit<Route, 'path'> = {
  component: StaffList,
  providers: [{ provide: SYNAX_ERROR_MESSAGES, useFactory: staffErrorMessages }],
  resolve: { translations: preloadTranslations },
  // One child per member, so opening another card keeps the drawer open.
  children: [
    {
      path: ':staffMemberId',
      component: StaffMemberDetails,
      canDeactivate: [leaveStaffMemberDetails],
    },
  ],
};
