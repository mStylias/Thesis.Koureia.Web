import type { CanDeactivateFn } from '@angular/router';

import type { ManagementCompany } from './management-company';

/** Asks before a navigation drops unsaved changes in any card of the company page. */
export const leaveManagementCompany: CanDeactivateFn<ManagementCompany> = (page) => page.canLeave();
