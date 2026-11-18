import { inject } from '@angular/core';
import { ResolveFn, Route } from '@angular/router';
import { TranslocoService } from '@jsverse/transloco';
import { appointmentsInlineLoader } from '@features/management-shared-appointments';
import { SYNAX_ERROR_MESSAGES } from '@synax/client';
import { forkJoin, map, type Observable } from 'rxjs';

import { dashboardErrorMessages } from './analytics-dashboard.errors';
import { dashboardInlineLoader } from './analytics-dashboard.i18n';
import { AnalyticsDashboard } from './page/analytics-dashboard';

/** The dictionaries before the page renders: the chart options translate imperatively. */
const preloadTranslations: ResolveFn<boolean> = () =>
  loadDashboardDictionaries(inject(TranslocoService)).pipe(map(() => true));

/**
 * The page's dictionaries in the active language: its own, and the appointments one for the
 * status names. The shell prefetches them.
 */
export function loadDashboardDictionaries(transloco: TranslocoService): Observable<unknown> {
  const lang = transloco.getActiveLang();
  return forkJoin([
    transloco.load(`managementDashboard/${lang}`, { inlineLoader: dashboardInlineLoader }),
    transloco.load(`managementAppointments/${lang}`, { inlineLoader: appointmentsInlineLoader }),
  ]);
}

/** The dashboard, as the host route wants it: no path of its own. */
export const dashboardRoute: Omit<Route, 'path'> = {
  component: AnalyticsDashboard,
  providers: [{ provide: SYNAX_ERROR_MESSAGES, useFactory: dashboardErrorMessages }],
  resolve: { translations: preloadTranslations },
};
