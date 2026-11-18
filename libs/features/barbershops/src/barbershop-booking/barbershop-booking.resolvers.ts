import { RESPONSE_INIT, inject } from '@angular/core';
import type { ActivatedRouteSnapshot, ResolveFn } from '@angular/router';
import { CustomerAppointmentsApi } from '@api/customer-appointments';
import type { Result } from '@synax/client/core';
import { ActiveLanguage } from '@util/language';
import { map, of } from 'rxjs';

import { BookingApi } from '../data/booking.api';
import type { CompanyBookingOptionsResponse } from '../data/booking.api.types';
import type { BookingPage, BookingSeed, ReschedulePage } from './booking.types';

/** The route `resolve` key that carries the {@link BookingPage}. */
export const BOOKING_PAGE = 'bookingPage';

const NOT_FOUND = 404;
const SERVER_ERROR = 500;

/**
 * Loads the shop's services and barbers.
 *
 * It never fails the navigation: an unknown slug and a failed call are both pages the visitor
 * lands on, so they resolve as states the page renders. Availability is deliberately **not**
 * resolved here — it changes by the minute, and a slot list rendered on the server is stale
 * before it paints.
 */
export const bookingPageResolver: ResolveFn<BookingPage> = (route) => {
  const api = inject(BookingApi);
  const language = inject(ActiveLanguage).value();
  const response = inject(RESPONSE_INIT, { optional: true });
  const slug = route.paramMap.get('slug') ?? '';

  return api.options(slug, language).pipe(
    map((result) => {
      const page = toPage(result);
      if (response !== null) markResponse(response, page);
      return page;
    }),
  );
};

/** The route `resolve` key that carries the {@link ReschedulePage}. */
export const RESCHEDULE_PAGE = 'reschedulePage';

/** The query parameter that names the appointment the page moves. */
export const RESCHEDULE_PARAM = 'reschedule';

/**
 * Loads the appointment `?reschedule={id}` names, when it does.
 *
 * It never fails the navigation. An appointment that is missing, another customer's, at another
 * shop, or past its cutoff resolves as `unavailable`, which the page renders instead of the steps.
 */
export const rescheduleResolver: ResolveFn<ReschedulePage> = (route) => {
  const id = route.queryParamMap.get(RESCHEDULE_PARAM);
  if (id === null || id === '') return of({ status: 'none' } as const);

  const api = inject(CustomerAppointmentsApi);
  const language = inject(ActiveLanguage).value();
  const slug = route.paramMap.get('slug') ?? '';

  return api.get(id, language).pipe(
    map((result): ReschedulePage => {
      const appointment = result.isSuccess ? result.data : null;
      return appointment !== null && appointment.canChange && appointment.companySlug === slug
        ? { status: 'found', appointment }
        : { status: 'unavailable', appointmentId: id };
    }),
  );
};

/** The {@link ReschedulePage} the route resolved. `none` when it resolved nothing. */
export function READ_RESCHEDULE_PAGE(route: ActivatedRouteSnapshot): ReschedulePage {
  return (route.data[RESCHEDULE_PAGE] as ReschedulePage | undefined) ?? { status: 'none' };
}

/**
 * The selection "Book again" arrives with, from `?services=a,b&barber=x`, or `null` when the
 * address carries none.
 */
export function readBookingSeed(route: ActivatedRouteSnapshot): BookingSeed | null {
  const services = route.queryParamMap.get('services');
  if (services === null || services === '') return null;

  const serviceIds = services.split(',').filter((id) => id !== '');
  if (serviceIds.length === 0) return null;

  const barber = route.queryParamMap.get('barber');
  return { serviceIds, staffMemberId: barber === null || barber === '' ? null : barber };
}

/** The {@link BookingPage} a route or one of its parents resolved. */
export function READ_BOOKING_PAGE(route: ActivatedRouteSnapshot): BookingPage {
  for (let current: ActivatedRouteSnapshot | null = route; current; current = current.parent) {
    const page = current.data[BOOKING_PAGE] as BookingPage | undefined;
    if (page !== undefined) return page;
  }
  return { status: 'failed' };
}

function toPage(result: Result<CompanyBookingOptionsResponse>): BookingPage {
  if (result.isSuccess) {
    return result.data === null ? { status: 'failed' } : { status: 'found', options: result.data };
  }
  return result.error.httpCode === NOT_FOUND ? { status: 'not-found' } : { status: 'failed' };
}

function markResponse(response: ResponseInit, page: BookingPage): void {
  if (page.status === 'found') return;

  response.status = page.status === 'not-found' ? NOT_FOUND : SERVER_ERROR;
  // A missing or broken page must not sit in a shared cache, and must not be indexed.
  if (response.headers instanceof Headers) {
    response.headers.set('Cache-Control', 'no-store');
    response.headers.set('X-Robots-Tag', 'noindex');
  }
}
