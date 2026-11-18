import { LOCALE_ID, inject } from '@angular/core';
import { CanActivateFn, RedirectCommand, Router } from '@angular/router';
import { SessionStore, StaffAccessStore } from '@auth/data-access';
import {
  AppLanguage,
  DEFAULT_APP_LANGUAGE,
  toAppLanguage,
  withLanguagePrefix,
} from '@util/language';

import { MANAGEMENT_BASE_PATH, MANAGEMENT_SECTIONS } from './management-pages';

/**
 * Guards the workspace itself: everything under `/management` is for staff.
 *
 * Three outcomes, because the two ways in are different problems:
 *
 * - **Signed out** — start sign-in and come back to the address that was asked for. A staff
 *   member whose session expired is the common case, and sending them to the landing page loses
 *   the page they wanted.
 * - **A plain customer** — the landing page. The workspace is not advertised to them, so this
 *   is a wrong turn rather than a refusal, and there is nothing for them to do about it.
 * - **Staff** — through.
 *
 * The parent of every management route carries this, so a page added later is covered by being
 * a page. {@link managementPageGuard} narrows it per page.
 */
export const managementAccessGuard: CanActivateFn = async (_route, state) => {
  const session = inject(SessionStore);
  const access = inject(StaffAccessStore);
  const router = inject(Router);
  // Read before the first `await`: a guard is in an injection context only while it runs
  // synchronously.
  const landing = router.parseUrl(withLanguagePrefix('/', guardLanguage()));

  await session.whenReady();

  if (!session.isSignedIn()) {
    // A document load to Keycloak, which replaces this page. `false` and not a redirect: the
    // navigation is being abandoned, and rendering the landing page first would flash content
    // nobody asked for on the way out.
    session.signIn(state.url);
    return false;
  }

  await access.resolve();
  return access.canOpenWorkspace() ? true : new RedirectCommand(landing);
};

/**
 * Refuses one page the caller holds no permission for, and sends them to a page they can open.
 *
 * Reached only through {@link managementAccessGuard}, so the caller is already staff and the
 * refusal is about this page rather than the workspace.
 */
export function managementPageGuard(permission: string): CanActivateFn {
  return () => {
    const access = inject(StaffAccessStore);
    const router = inject(Router);

    if (access.has(permission)) return true;

    // No page at all means an account that is staff somewhere the sections do not cover. The
    // workspace has nothing to show it, so it leaves.
    const fallback = firstPermittedPage(access) ?? withLanguagePrefix('/', guardLanguage());
    return new RedirectCommand(router.parseUrl(fallback));
  };
}

/** The first page in the sidebar's own order that the caller may open, as an address. */
function firstPermittedPage(access: StaffAccessStore): string | null {
  const page = MANAGEMENT_SECTIONS.flatMap((section) => section.pages).find((candidate) =>
    access.has(candidate.permission),
  );
  return page === undefined ? null : `${MANAGEMENT_BASE_PATH}/${page.path}`;
}

/**
 * The language to redirect in.
 *
 * `LOCALE_ID` and not `ActiveLanguage`: guards run before every resolver, so
 * `activateBrowserLanguage` has not written the active language yet. `LOCALE_ID` is fixed at
 * bootstrap from the same path-then-cookie order, which makes it the one source that answers
 * this early — see `provideAppLanguage`.
 */
function guardLanguage(): AppLanguage {
  return toAppLanguage(inject(LOCALE_ID)) ?? DEFAULT_APP_LANGUAGE;
}
