import type { CanDeactivateFn } from '@angular/router';

import type { ManagementProfile } from './management-profile';

/** Asks before a navigation drops unsaved changes in any card of the profile page. */
export const leaveManagementProfile: CanDeactivateFn<ManagementProfile> = (page) => page.canLeave();
