import { Route } from '@angular/router';

import { managementRoutes } from './lib.routes';
import {
  MANAGEMENT_COMPANY_PAGE,
  MANAGEMENT_HOME_PAGE,
  MANAGEMENT_PROFILE_PAGE,
  MANAGEMENT_SECTIONS,
} from './management-pages';

const shell = managementRoutes[0];
const children: Route[] = shell.children ?? [];

describe('management routes', () => {
  it('renders every page inside one shell', () => {
    expect(managementRoutes).toHaveLength(1);
    expect(shell.path).toBe('');
    expect(shell.component).toBeDefined();
  });

  it('loads its dictionaries before the shell renders', () => {
    // The sidebar labels come from `translate`, which answers with the key until then.
    expect(shell.resolve).toHaveProperty('translations');
  });

  it('publishes one route per navigation entry', () => {
    const pages = MANAGEMENT_SECTIONS.flatMap((section) => section.pages);

    expect(
      children
        .filter(
          (child) =>
            child.path !== '' &&
            child.path !== MANAGEMENT_PROFILE_PAGE &&
            child.path !== MANAGEMENT_COMPANY_PAGE,
        )
        .map((child) => child.path),
    ).toEqual(pages.map((page) => page.path));
  });

  it('titles each page with the key its sidebar option reads', () => {
    const titles = new Map(children.map((child) => [child.path, child.title]));

    for (const page of MANAGEMENT_SECTIONS.flatMap((section) => section.pages)) {
      expect(titles.get(page.path)).toBe(page.titleKey);
    }
  });

  it('opens on a real page rather than an empty shell', () => {
    const index = children.find((child) => child.path === '');

    expect(index).toMatchObject({ pathMatch: 'full', redirectTo: MANAGEMENT_HOME_PAGE });
    expect(children.some((child) => child.path === MANAGEMENT_HOME_PAGE)).toBe(true);
  });

  it('has no wildcard child, so an unknown address reaches the app 404', () => {
    expect(children.some((child) => child.path === '**')).toBe(false);
  });

  describe('the company page', () => {
    const company = children.find((child) => child.path === MANAGEMENT_COMPANY_PAGE);

    it('is a child of the shell, titled for the top bar', () => {
      expect(company).toMatchObject({ title: 'management.nav.company' });
      expect(company?.loadComponent).toBeDefined();
    });

    it('opens for every workspace member, so it carries no permission guard', () => {
      expect(company?.canActivate ?? []).toEqual([]);
    });

    it('asks before it drops unsaved changes', () => {
      expect(company?.canDeactivate).toHaveLength(1);
    });

    it('is not a sidebar page, so no sidebar item lights up on it', () => {
      const pages = MANAGEMENT_SECTIONS.flatMap((section) => section.pages.map((p) => p.path));

      // The sidebar matches by prefix, so no page path can be a prefix of the company path.
      expect(pages.some((path) => MANAGEMENT_COMPANY_PAGE.startsWith(path))).toBe(false);
    });
  });

  describe('the profile page', () => {
    const profile = children.find((child) => child.path === MANAGEMENT_PROFILE_PAGE);

    it('is a child of the shell, titled for the top bar', () => {
      expect(profile).toMatchObject({ title: 'management.nav.profile' });
      expect(profile?.loadComponent).toBeDefined();
    });

    it('opens for every workspace member, so it carries no permission guard', () => {
      // A `staff` member with no other code passes `managementAccessGuard` on the shell and
      // nothing else stands in the way.
      expect(profile?.canActivate ?? []).toEqual([]);
    });

    it('asks before it drops unsaved changes', () => {
      expect(profile?.canDeactivate).toHaveLength(1);
    });

    it('is not a sidebar page, so no sidebar item lights up on it', () => {
      const pages = MANAGEMENT_SECTIONS.flatMap((section) => section.pages.map((p) => p.path));

      // The sidebar matches by prefix, so no page path can be a prefix of the profile path.
      expect(pages.some((path) => MANAGEMENT_PROFILE_PAGE.startsWith(path))).toBe(false);
    });
  });
});
