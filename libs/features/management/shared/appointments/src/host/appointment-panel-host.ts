import { InjectionToken } from '@angular/core';

import type { AppointmentPanelHost } from './appointment-panel-host.types';

/** The page the drawer opens on. Provide it beside the route that renders the drawer. */
export const APPOINTMENT_PANEL_HOST = new InjectionToken<AppointmentPanelHost>(
  'APPOINTMENT_PANEL_HOST',
);

/** The route parameter that means "not an appointment yet". */
export const NEW_APPOINTMENT = 'new';

/** The management page that lists the shop's appointments, a sibling of the calendar. */
export const APPOINTMENTS_PAGE = 'appointments';

/** The appointments page's query parameter that opens it on one customer. */
export const CUSTOMER_PARAM = 'customer';
