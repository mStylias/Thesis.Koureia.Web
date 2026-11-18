import { computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import {
  APPOINTMENTS_PAGE,
  CUSTOMER_PARAM,
  NEW_APPOINTMENT,
  prefillEqual,
  readPrefill,
  type AppointmentPanelHost,
} from '@features/management-shared-appointments';

import { CalendarStore } from '../calendar.store';
import type { CalendarSlotParams } from '../calendar.types';

/**
 * The calendar as the appointment drawer's page. Provided by `CalendarPage`, so it reads the
 * page's store and navigates relative to the page's route.
 *
 * Every move goes through the address. The page's own subscription applies the address to the
 * store, so the drawer never writes the store's position behind the router's back.
 */
export function calendarPanelHost(): AppointmentPanelHost {
  const store = inject(CalendarStore);
  const router = inject(Router);
  const route = inject(ActivatedRoute);

  const query = toSignal(route.queryParamMap, { initialValue: route.snapshot.queryParamMap });

  const prefill = computed(() => readPrefill(query()), { equal: prefillEqual });

  const staff = computed(() => {
    const swatches = new Map(
      store.allResources().map((resource) => [resource.id, resource.swatch]),
    );
    return store.roster().map((member) => {
      const swatch = swatches.get(member.id);
      return {
        id: member.id,
        displayName: member.displayName,
        isActive: member.isActive,
        swatch: swatch === undefined ? null : `var(--swatch-${swatch.toString()})`,
      };
    });
  });

  const show = (id: string, localDate: string, replaceUrl: boolean): void => {
    void router.navigate([id], {
      relativeTo: route,
      queryParams: store.positionFor(localDate),
      replaceUrl,
    });
  };

  return {
    prefill,
    staff,
    timezone: store.timezone,
    selected: store.selectedId,
    open: (id, localDate) => {
      show(id, localDate, false);
    },
    create: (next) => {
      const barberIds = store.filters().barberIds;
      const params: CalendarSlotParams = {
        slotDate: next.localDate ?? store.createDate(),
        ...(next.localStartTime === undefined ? {} : { slotTime: next.localStartTime }),
        ...(next.staffMemberId !== undefined
          ? { barberId: next.staffMemberId }
          : barberIds.length === 1 && next.rebookId === undefined
            ? { barberId: barberIds[0] }
            : {}),
        ...(next.rebookId === undefined ? {} : { rebook: next.rebookId }),
      };
      void router.navigate([NEW_APPOINTMENT], {
        relativeTo: route,
        queryParams: { ...store.positionParams(), ...params },
      });
    },
    close: () => {
      void router.navigate(['.'], { relativeTo: route, queryParams: store.positionParams() });
    },
    // The appointments grid on this customer. It needs `appointments:read_all`, as this page does.
    customerAppointments: (customerId) =>
      router.createUrlTree(['..', APPOINTMENTS_PAGE], {
        relativeTo: route,
        queryParams: { [CUSTOMER_PARAM]: customerId },
      }),
    written: (appointment, created) => {
      store.reload();
      if (created || !store.shows(appointment.localDate)) {
        show(appointment.id, appointment.localDate, true);
      }
    },
  };
}
