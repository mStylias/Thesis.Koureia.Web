import type { TranslocoService } from '@jsverse/transloco';
import { loadDashboardDictionaries } from '@features/management-analytics-dashboard';
import { loadAppointmentsDictionaries } from '@features/management-operations-appointments';
import { loadCalendarDictionaries } from '@features/management-operations-calendar';
import { loadCompanyDictionaries } from '@features/management-company';
import { loadCustomersDictionaries } from '@features/management-operations-customers';
import { loadServicesDictionaries } from '@features/management-operations-services';
import { loadProfileDictionaries } from '@features/management-profile';
import { loadStaffDictionaries } from '@features/management-operations-staff';
import { loadRolesDictionaries } from '@features/management-settings-roles';
import { forkJoin } from 'rxjs';

/**
 * The dictionaries of every page in `PAGE_ROUTES`, and of the profile and company pages. A page
 * with a dictionary resolver adds its loader.
 */
const PAGE_DICTIONARIES = [
  loadCalendarDictionaries,
  loadAppointmentsDictionaries,
  loadCustomersDictionaries,
  loadServicesDictionaries,
  loadStaffDictionaries,
  loadDashboardDictionaries,
  loadRolesDictionaries,
  loadProfileDictionaries,
  loadCompanyDictionaries,
] as const;

/**
 * Loads every page's dictionaries in the active language once the browser is idle, so the first
 * click on a page does not wait for its dictionary.
 *
 * The pages keep their resolvers. A click that lands before the prefetch finishes waits for the
 * same request, because Transloco shares a load in flight, and a page never renders a raw key.
 */
export function prefetchPageDictionaries(transloco: TranslocoService): void {
  const run = (): void => {
    // A failure is the resolver's to report, when the page is opened.
    forkJoin(PAGE_DICTIONARIES.map((load) => load(transloco))).subscribe({
      error: () => undefined,
    });
  };
  if (typeof requestIdleCallback === 'function') {
    requestIdleCallback(run, { timeout: PREFETCH_TIMEOUT_MS });
  } else {
    setTimeout(run, 0);
  }
}

/** The longest the prefetch waits for an idle moment. */
const PREFETCH_TIMEOUT_MS = 2000;
