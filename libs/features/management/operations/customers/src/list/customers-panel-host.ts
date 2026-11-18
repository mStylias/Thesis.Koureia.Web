import { computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import {
  APPOINTMENTS_PAGE,
  CUSTOMER_PARAM,
  NEW_APPOINTMENT,
  prefillEqual,
  prefillParams,
  readPrefill,
  type AppointmentPanelHost,
} from '@features/management-shared-appointments';

import { CustomersStore } from '../customers.store';

/** The path segment between a customer and one of their appointments. */
export const CUSTOMER_APPOINTMENTS = 'appointments';

/**
 * The customers page as the appointment drawer's page. Provided by `CustomersList`, so it
 * navigates relative to the page's route.
 *
 * An appointment opens under its customer, `<customerId>/appointments/<id>`, in place of the
 * customer's drawer. Its close goes back to the customer.
 */
export function customersPanelHost(): AppointmentPanelHost {
  const store = inject(CustomersStore);
  const router = inject(Router);
  const route = inject(ActivatedRoute);

  const query = toSignal(route.queryParamMap, { initialValue: route.snapshot.queryParamMap });

  const prefill = computed(() => readPrefill(query()), { equal: prefillEqual });

  // No swatch: the page draws no barber colours.
  const staff = computed(() =>
    store.staff().map((member) => ({
      id: member.id,
      displayName: member.displayName,
      isActive: member.isActive,
      swatch: null,
    })),
  );

  /** The customer of the open drawer, read when the drawer acts. */
  const customerId = (): string => route.firstChild?.snapshot.paramMap.get('customerId') ?? '';

  const show = (id: string, replaceUrl: boolean): void => {
    void router.navigate([customerId(), CUSTOMER_APPOINTMENTS, id], {
      relativeTo: route,
      replaceUrl,
    });
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
      void router.navigate([customerId(), CUSTOMER_APPOINTMENTS, NEW_APPOINTMENT], {
        relativeTo: route,
        queryParams: prefillParams({ customerId: customerId(), ...next }),
      });
    },
    close: () => {
      void router.navigate([customerId()], { relativeTo: route });
    },
    // The appointments grid on this customer. It needs `appointments:read_all`, as the list does.
    customerAppointments: (id) =>
      router.createUrlTree(['..', APPOINTMENTS_PAGE], {
        relativeTo: route,
        queryParams: { [CUSTOMER_PARAM]: id },
      }),
    written: (appointment, created) => {
      store.reload();
      if (created) show(appointment.id, true);
    },
  };
}
