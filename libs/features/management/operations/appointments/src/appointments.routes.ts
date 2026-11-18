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

import { appointmentsGridInlineLoader } from './appointments.i18n';
import { AppointmentsList } from './list/appointments-list';

/**
 * Both dictionaries before the page renders. The captions, the status labels and the
 * header-filter lists are translated imperatively, and a label read early would stay the key.
 */
const preloadTranslations: ResolveFn<boolean> = () =>
  loadAppointmentsDictionaries(inject(TranslocoService)).pipe(map(() => true));

/**
 * The page's dictionaries in the active language. The shell prefetches them, so the resolver
 * above usually finds them loaded.
 */
export function loadAppointmentsDictionaries(transloco: TranslocoService): Observable<unknown> {
  const lang = transloco.getActiveLang();
  return forkJoin([
    transloco.load(`managementAppointmentsGrid/${lang}`, {
      inlineLoader: appointmentsGridInlineLoader,
    }),
    transloco.load(`managementAppointments/${lang}`, { inlineLoader: appointmentsInlineLoader }),
  ]);
}

/**
 * The appointments screen, as the host route wants it: no path of its own. The page reads its
 * data itself, so a click paints the page at once.
 */
export const appointmentsRoute: Omit<Route, 'path'> = {
  component: AppointmentsList,
  providers: [provideDatagridExcel(), provideDatagridPdf()],
  resolve: { translations: preloadTranslations },
  // `new` and an appointment id are one route, so opening another row keeps the drawer open.
  children: [
    {
      path: ':appointmentId',
      component: AppointmentDetails,
      canDeactivate: [leaveAppointmentDetails],
      runGuardsAndResolvers: appointmentDetailsChanged,
    },
  ],
};
