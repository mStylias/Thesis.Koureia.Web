import { inject } from '@angular/core';
import { ResolveFn, Route } from '@angular/router';
import { TranslocoService } from '@jsverse/transloco';
import { provideDatagridExcel, provideDatagridPdf } from '@ui/datagrid';
import { map, type Observable } from 'rxjs';

import { ServiceDetails } from './details/service-details';
import { leaveServiceDetails } from './details/service-details.guard';
import { ServicesList } from './list/services-list';
import { servicesInlineLoader } from './services.i18n';

/** The dictionary before the page renders: the captions and filter lists are built imperatively. */
const preloadTranslations: ResolveFn<boolean> = () =>
  loadServicesDictionaries(inject(TranslocoService)).pipe(map(() => true));

/** The page's dictionary in the active language. The shell prefetches it. */
export function loadServicesDictionaries(transloco: TranslocoService): Observable<unknown> {
  return transloco.load(`managementServices/${transloco.getActiveLang()}`, {
    inlineLoader: servicesInlineLoader,
  });
}

/** The services screen, as the host route wants it: no path of its own. */
export const servicesRoute: Omit<Route, 'path'> = {
  component: ServicesList,
  providers: [provideDatagridExcel(), provideDatagridPdf()],
  resolve: { translations: preloadTranslations },
  // `new` and a service id are one route, so a create moves to its id without closing the drawer.
  children: [
    { path: ':serviceId', component: ServiceDetails, canDeactivate: [leaveServiceDetails] },
  ],
};
