import { inject, isDevMode } from '@angular/core';
import { ResolveFn, Route } from '@angular/router';
import { TranslocoService } from '@jsverse/transloco';
import { themeToggleInlineLoader } from '@ui/theme-toggle';
import { dashboardRoute } from '@features/management-analytics-dashboard';
import { appointmentsRoute } from '@features/management-operations-appointments';
import { companyRoute } from '@features/management-company';
import { calendarRoute } from '@features/management-operations-calendar';
import { customersRoute } from '@features/management-operations-customers';
import { servicesRoute } from '@features/management-operations-services';
import { staffRoute } from '@features/management-operations-staff';
import { profileRoute } from '@features/management-profile';
import { rolesRoute } from '@features/management-settings-roles';
import { forkJoin, map } from 'rxjs';

import { managementAccessGuard, managementPageGuard } from './management-access.guard';
import { managementInlineLoader } from './management.i18n';
import { ManagementPlaceholder } from './management-placeholder/management-placeholder';
import { ManagementShell } from './management-shell/management-shell';
import {
  MANAGEMENT_COMPANY_PAGE,
  MANAGEMENT_HOME_PAGE,
  MANAGEMENT_PROFILE_PAGE,
  MANAGEMENT_SECTIONS,
} from './management-pages';

/**
 * Loads both dictionaries the shell renders from before it renders.
 *
 * The sidebar builds `SidebarGroup` objects out of plain strings, so its labels come from
 * `TranslocoService.translate`, which answers with the key itself until the dictionary is
 * there. The root dictionary joins it because these addresses carry no `:lang` segment, so
 * `activateLanguage` never runs for them and nothing else loads it.
 */
const preloadManagementTranslations: ResolveFn<boolean> = () => {
  const transloco = inject(TranslocoService);
  const lang = transloco.getActiveLang();

  return forkJoin([
    transloco.load(lang),
    transloco.load(`management/${lang}`, { inlineLoader: managementInlineLoader }),
    // The top bar renders the theme toggle in a development build only, so a production render
    // must not pay for a dictionary nothing reads. Same condition as `ManagementShell`. The
    // toggle's own scope provider would fetch this too late for a server render, which is one
    // shot and would bake an empty `aria-label` into the HTML.
    ...(isDevMode()
      ? [transloco.load(`themeToggle/${lang}`, { inlineLoader: themeToggleInlineLoader })]
      : []),
  ]).pipe(map(() => true));
};

/**
 * Pages with a screen of their own. Everything else still renders the placeholder.
 *
 * A page lib contributes the whole route body, not just a component, so it can carry its own
 * resolvers and providers without this file knowing what they are.
 */
const PAGE_ROUTES: Readonly<Partial<Record<string, Omit<Route, 'path'>>>> = {
  calendar: calendarRoute,
  appointments: appointmentsRoute,
  customers: customersRoute,
  services: servicesRoute,
  staff: staffRoute,
  dashboard: dashboardRoute,
  roles: rolesRoute,
};

/**
 * One child route per entry of `MANAGEMENT_SECTIONS`, so the nav, the routes and the
 * authorization cannot drift.
 *
 * The page's own `canActivate` is kept and the permission guard added to it. Overwriting it
 * would silently drop a guard a page lib shipped for its own reasons.
 */
const pageRoutes: Route[] = MANAGEMENT_SECTIONS.flatMap((section) =>
  section.pages.map((page) => {
    const contributed = PAGE_ROUTES[page.path];

    return {
      component: ManagementPlaceholder,
      ...contributed,
      path: page.path,
      canActivate: [...(contributed?.canActivate ?? []), managementPageGuard(page.permission)],
      // The same key the sidebar option and the top bar heading read.
      title: page.titleKey,
    };
  }),
);

export const managementRoutes: Route[] = [
  {
    path: '',
    component: ManagementShell,
    // On the parent, so every page under `/management` is gated by being a page — including one
    // added later. It runs before the resolver below, which is why the guard cannot read the
    // active language: guards precede every resolver in a navigation.
    canActivate: [managementAccessGuard],
    resolve: { translations: preloadManagementTranslations },
    // No wildcard child: an address nobody published must fall through to the app's 404 page,
    // the same one every other unknown address gets, rather than being absorbed by the shell.
    children: [
      { path: '', pathMatch: 'full', redirectTo: MANAGEMENT_HOME_PAGE },
      ...pageRoutes,
      // No permission guard: everyone who can open the workspace can open their own profile.
      { ...profileRoute, path: MANAGEMENT_PROFILE_PAGE, title: 'management.nav.profile' },
      // No permission guard: every member can read the shop's settings. The API checks writes.
      { ...companyRoute, path: MANAGEMENT_COMPANY_PAGE, title: 'management.nav.company' },
    ],
  },
];
