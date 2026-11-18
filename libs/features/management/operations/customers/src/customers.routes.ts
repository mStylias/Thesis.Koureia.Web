import { inject } from '@angular/core';
import { ResolveFn, Route } from '@angular/router';
import { TranslocoService } from '@jsverse/transloco';
import {
  AppointmentDetails,
  appointmentDetailsChanged,
  appointmentsInlineLoader,
  leaveAppointmentDetails,
} from '@features/management-shared-appointments';
import { provideDatagridExcel, provideDatagridPdf } from '@ui/datagrid';
import { forkJoin, map, type Observable } from 'rxjs';

import { customersInlineLoader } from './customers.i18n';
import { CustomerDetails } from './details/customer-details';
import { leaveCustomerDetails } from './details/customer-details.guard';
import { CustomersList } from './list/customers-list';
import { CUSTOMER_APPOINTMENTS } from './list/customers-panel-host';

/** The dictionary before the page renders: the captions and filter lists are built imperatively. */
const preloadTranslations: ResolveFn<boolean> = () =>
  loadCustomersDictionaries(inject(TranslocoService)).pipe(map(() => true));

/**
 * The page's dictionaries in the active language: its own, and the appointment list's, which the
 * drawer shows. A scope the drawer provides second is not loaded by its pipes. The shell
 * prefetches both.
 */
export function loadCustomersDictionaries(transloco: TranslocoService): Observable<unknown> {
  const lang = transloco.getActiveLang();
  return forkJoin([
    transloco.load(`managementCustomers/${lang}`, { inlineLoader: customersInlineLoader }),
    transloco.load(`managementAppointments/${lang}`, { inlineLoader: appointmentsInlineLoader }),
  ]);
}

/** The customers screen, as the host route wants it: no path of its own. */
export const customersRoute: Omit<Route, 'path'> = {
  component: CustomersList,
  providers: [provideDatagridExcel(), provideDatagridPdf()],
  resolve: { translations: preloadTranslations },
  // An appointment of the customer is a sibling of the customer, so it takes the drawer's place.
  // `new` and an id are one route, so a create that saves keeps the drawer open.
  children: [
    { path: ':customerId', component: CustomerDetails, canDeactivate: [leaveCustomerDetails] },
    {
      path: `:customerId/${CUSTOMER_APPOINTMENTS}/:appointmentId`,
      component: AppointmentDetails,
      canDeactivate: [leaveAppointmentDetails],
      runGuardsAndResolvers: appointmentDetailsChanged,
    },
  ],
};
