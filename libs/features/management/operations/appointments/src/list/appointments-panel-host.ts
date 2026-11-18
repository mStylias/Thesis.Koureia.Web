import { computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import {
  CUSTOMER_PARAM,
  NEW_APPOINTMENT,
  PREFILL_PARAMS,
  prefillEqual,
  prefillParams,
  readPrefill,
  type AppointmentPanelHost,
} from '@features/management-shared-appointments';

import { AppointmentsStore } from '../appointments.store';

/**
 * The grid as the appointment drawer's page. Provided by `AppointmentsList`, so it navigates
 * relative to the page's route.
 *
 * Unlike the calendar, the page does not move to an appointment's date: the grid holds its
 * filter, and a saved appointment outside it is still the one the drawer shows.
 */
export function appointmentsPanelHost(): AppointmentPanelHost {
  const store = inject(AppointmentsStore);
  const router = inject(Router);
  const route = inject(ActivatedRoute);

  const query = toSignal(route.queryParamMap, { initialValue: route.snapshot.queryParamMap });

  const prefill = computed(() => readPrefill(query()), { equal: prefillEqual });

  // No swatch: the grid draws no barber colours.
  const staff = computed(() =>
    store.roster().map((member) => ({
      id: member.id,
      displayName: member.displayName,
      isActive: member.isActive,
      swatch: null,
    })),
  );

  /** The page's own query, without a create's prefill. `?customer=` stays. */
  const pageParams = (): Record<string, string> => {
    const params: Record<string, string> = {};
    for (const name of query().keys) {
      const value = query().get(name);
      if (value !== null && !(PREFILL_PARAMS as readonly string[]).includes(name)) {
        params[name] = value;
      }
    }
    return params;
  };

  const show = (id: string, replaceUrl: boolean): void => {
    void router.navigate([id], { relativeTo: route, queryParams: pageParams(), replaceUrl });
  };

  return {
    prefill,
    staff,
    timezone: store.timezone,
    selected: null,
    open: (id) => {
      show(id, false);
    },
    create: (next) => {
      void router.navigate([NEW_APPOINTMENT], {
        relativeTo: route,
        queryParams: { ...pageParams(), ...prefillParams(next) },
      });
    },
    close: () => {
      void router.navigate(['.'], { relativeTo: route, queryParams: pageParams() });
    },
    // This page, on the customer. The drawer closes on the way, as any navigation to `.` does.
    customerAppointments: (customerId) =>
      router.createUrlTree(['.'], {
        relativeTo: route,
        queryParams: { [CUSTOMER_PARAM]: customerId },
      }),
    written: (appointment, created) => {
      store.reload();
      if (created) {
        show(appointment.id, true);
      }
    },
  };
}
