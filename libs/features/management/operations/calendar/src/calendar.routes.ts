import { inject } from '@angular/core';
import { ResolveFn, Route } from '@angular/router';
import { TranslocoService } from '@jsverse/transloco';
import { forkJoin, map, type Observable } from 'rxjs';
import {
  AppointmentDetails,
  appointmentDetailsChanged,
  appointmentsInlineLoader,
  leaveAppointmentDetails,
} from '@features/management-shared-appointments';

import { calendarInlineLoader } from './calendar.i18n';
import { CalendarPage } from './page/calendar-page';

/**
 * The page's dictionaries in the active language. The shell prefetches them, so the resolver
 * below usually finds them loaded.
 */
export function loadCalendarDictionaries(transloco: TranslocoService): Observable<unknown> {
  const lang = transloco.getActiveLang();
  return forkJoin([
    transloco.load(`managementCalendar/${lang}`, { inlineLoader: calendarInlineLoader }),
    transloco.load(`managementAppointments/${lang}`, { inlineLoader: appointmentsInlineLoader }),
  ]);
}

/**
 * Loads the dictionaries before the page renders. The store translates the status badges
 * imperatively from the appointments scope, and a label read before the dictionary arrives would
 * stay the raw key.
 */
const preloadCalendarTranslations: ResolveFn<boolean> = () =>
  loadCalendarDictionaries(inject(TranslocoService)).pipe(map(() => true));

/**
 * The calendar screen, as the host route wants it: no path of its own. The page reads its data
 * itself, so a click paints the page at once.
 */
export const calendarRoute: Omit<Route, 'path'> = {
  component: CalendarPage,
  resolve: { translations: preloadCalendarTranslations },
  // `new` and an appointment id are one route, so opening another tile keeps the drawer open.
  // The guard asks before an edit with changes is dropped, and runs only when the drawer would
  // show something else, never when the calendar moves behind it.
  children: [
    {
      path: ':appointmentId',
      component: AppointmentDetails,
      canDeactivate: [leaveAppointmentDetails],
      runGuardsAndResolvers: appointmentDetailsChanged,
    },
  ],
};
