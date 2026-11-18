import {
  LucideBriefcaseBusiness,
  LucideCalendarCheck,
  LucideCalendarDays,
  LucideLayoutDashboard,
  LucideScissors,
  LucideShieldCheck,
  LucideUsers,
} from '@lucide/angular';

import type { ManagementSection } from './management-pages.types';

export type { ManagementPage, ManagementSection } from './management-pages.types';

/** Root of every management address. */
export const MANAGEMENT_BASE_PATH = '/management';

/** The page `/management` opens. */
export const MANAGEMENT_HOME_PAGE = 'calendar';

/** The signed-in person's own page. Not a sidebar page, so it is not in `MANAGEMENT_SECTIONS`. */
export const MANAGEMENT_PROFILE_PAGE = 'profile';

/** The shop's own settings. Not a sidebar page, so it is not in `MANAGEMENT_SECTIONS`. */
export const MANAGEMENT_COMPANY_PAGE = 'company';

/**
 * The navigation, once. The routes, the sidebar groups and the per-page authorization are all
 * built from this table, so a new page is one entry plus its label in `i18n/`.
 *
 * `permission` names a code from the API's catalog, `PermissionCodes` in
 * `Aptison.Booking.Domain`. It is the frontend's copy of an authorization the API enforces
 * again on every call, so a stale entry here hides or shows a page — it never grants anything.
 */
export const MANAGEMENT_SECTIONS: readonly ManagementSection[] = [
  {
    headingKey: 'management.groups.operations',
    pages: [
      {
        path: 'calendar',
        titleKey: 'management.nav.calendar',
        icon: LucideCalendarDays,
        permission: 'appointments:read_all',
      },
      {
        path: 'appointments',
        titleKey: 'management.nav.appointments',
        icon: LucideCalendarCheck,
        permission: 'appointments:read_all',
      },
      {
        path: 'customers',
        titleKey: 'management.nav.customers',
        icon: LucideUsers,
        // Its own code: the `staff` role holds `appointments:read_all` and must not open this.
        permission: 'customers:read',
      },
      {
        path: 'services',
        titleKey: 'management.nav.services',
        icon: LucideScissors,
        permission: 'services:read',
      },
      {
        path: 'staff',
        titleKey: 'management.nav.staff',
        icon: LucideBriefcaseBusiness,
        // The company's people, which is what `members:*` covers. `staff:*` is a barber's own
        // schedule and services, not the roster.
        permission: 'members:read',
      },
    ],
  },
  {
    headingKey: 'management.groups.analytics',
    pages: [
      {
        path: 'dashboard',
        titleKey: 'management.nav.dashboard',
        icon: LucideLayoutDashboard,
        // Its own code, not `appointments:read_all`: the `staff` role holds that one, and a
        // barber must not see the shop's revenue.
        permission: 'analytics:read',
      },
    ],
  },
  {
    headingKey: 'management.groups.settings',
    pages: [
      {
        path: 'roles',
        titleKey: 'management.nav.roles',
        icon: LucideShieldCheck,
        permission: 'roles:read',
      },
    ],
  },
];
