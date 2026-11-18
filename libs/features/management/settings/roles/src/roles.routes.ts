import { inject } from '@angular/core';
import { ResolveFn, Route } from '@angular/router';
import { TranslocoService } from '@jsverse/transloco';
import { provideDatagridExcel, provideDatagridPdf } from '@ui/datagrid';
import { map, type Observable } from 'rxjs';

import { RoleDetails } from './details/role-details';
import { RolesList } from './list/roles-list';
import { rolesInlineLoader } from './roles.i18n';

/**
 * Loads the dictionary before the page renders.
 *
 * The column captions are built in a `computed` that tracks the active language, not the
 * dictionary, so a caption read before the dictionary arrives would stay the raw key.
 */
const preloadRolesTranslations: ResolveFn<boolean> = () =>
  loadRolesDictionaries(inject(TranslocoService)).pipe(map(() => true));

/**
 * The page's dictionary in the active language. The shell prefetches it, so the resolver above
 * usually finds it loaded.
 */
export function loadRolesDictionaries(transloco: TranslocoService): Observable<unknown> {
  return transloco.load(`managementRoles/${transloco.getActiveLang()}`, {
    inlineLoader: rolesInlineLoader,
  });
}

/** The roles screen, as the host route wants it: no path of its own. */
export const rolesRoute: Omit<Route, 'path'> = {
  component: RolesList,
  // The spreadsheet and PDF writers, which the export menu offers beside CSV. They are
  // `EnvironmentProviders`, so they belong to the route rather than the page.
  providers: [provideDatagridExcel(), provideDatagridPdf()],
  resolve: { translations: preloadRolesTranslations },
  // The panel over the list is an address of its own, so it is bookmarkable and the browser's
  // back button closes it. `new` and a role id are one route rather than two: a save moves
  // from the first to the second, and a second route would tear the panel down and slide the
  // drawer shut and open again on a create the user has just completed.
  children: [{ path: ':roleId', component: RoleDetails }],
};
