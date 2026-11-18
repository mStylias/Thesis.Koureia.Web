import { RESPONSE_INIT, inject } from '@angular/core';
import type { ResolveFn } from '@angular/router';
import { CustomerAppointmentsApi, type AppointmentResponse } from '@api/customer-appointments';
import type { Result } from '@synax/client/core';
import { ActiveLanguage } from '@util/language';
import { map } from 'rxjs';

import type { AppointmentPage } from '../../account.types';

/** The route `resolve` key that carries the {@link AppointmentPage}. */
export const APPOINTMENT_PAGE = 'appointmentPage';

const NOT_FOUND = 404;
const SERVER_ERROR = 500;

/**
 * Loads one of the customer's appointments.
 *
 * It never fails the navigation: a missing appointment, another customer's, and a failed call
 * are all pages the customer lands on, so they resolve as states the page renders.
 */
export const appointmentPageResolver: ResolveFn<AppointmentPage> = (route) => {
  const api = inject(CustomerAppointmentsApi);
  const language = inject(ActiveLanguage).value();
  const response = inject(RESPONSE_INIT, { optional: true });
  const id = route.paramMap.get('id') ?? '';

  return api.get(id, language).pipe(
    map((result) => {
      const page = toAppointmentPage(result);
      if (response !== null && page.status !== 'found') {
        response.status = page.status === 'not-found' ? NOT_FOUND : SERVER_ERROR;
      }
      return page;
    }),
  );
};

/** A read of the appointment as the page state it renders. */
export function toAppointmentPage(result: Result<AppointmentResponse>): AppointmentPage {
  if (result.isSuccess) {
    return result.data === null
      ? { status: 'failed' }
      : { status: 'found', appointment: result.data };
  }
  return result.error.httpCode === NOT_FOUND ? { status: 'not-found' } : { status: 'failed' };
}
