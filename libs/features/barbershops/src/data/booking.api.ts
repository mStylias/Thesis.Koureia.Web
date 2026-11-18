import { HttpClient, HttpContext, HttpParams } from '@angular/common/http';
import { Service, inject } from '@angular/core';
import { PUBLIC_TRANSFERABLE } from '@api/core';
import { injectSynaxUrl, toResult } from '@synax/client';
import { Result } from '@synax/client/core';
import { map, type Observable } from 'rxjs';

import type {
  AppointmentResponse,
  AvailabilityQuery,
  AvailableDaysResponse,
  BookingAccessResponse,
  CompanyBookingOptionsResponse,
  CreateAppointmentRequest,
  DayAvailabilityResponse,
} from './booking.api.types';

/**
 * The booking flow's endpoints.
 *
 * Three of the four are anonymous; only creating the appointment needs a session. The one the
 * customer is signed in for is also the only one that changes anything.
 */
@Service()
export class BookingApi {
  private readonly http = inject(HttpClient);
  private readonly url = injectSynaxUrl();

  /**
   * The services and barbers of one shop.
   *
   * The same for everyone who asks in one language and stable for as long as the shop's catalog
   * is, so it opts into the transfer cache: without that the server render of this page is
   * thrown away and refetched the moment the browser takes over. An unknown slug fails with
   * `httpCode` 404.
   */
  options(slug: string, languageCode: string): Observable<Result<CompanyBookingOptionsResponse>> {
    return this.http
      .get<CompanyBookingOptionsResponse>(
        this.url(`companies/${encodeURIComponent(slug)}/booking-options`),
        {
          params: new HttpParams().set('languageCode', languageCode),
          context: new HttpContext().set(PUBLIC_TRANSFERABLE, true),
        },
      )
      .pipe(toResult<CompanyBookingOptionsResponse>());
  }

  /**
   * Whether the signed-in person can book this shop online. Never transfer-cached: it is the
   * person's own answer, and a shop can block them at any moment.
   */
  bookingAccess(slug: string): Observable<Result<BookingAccessResponse>> {
    return this.http
      .get<BookingAccessResponse>(this.url(`users/me/booking-access/${encodeURIComponent(slug)}`))
      .pipe(toResult<BookingAccessResponse>());
  }

  /**
   * The days in `[from, to]` that can take this selection.
   *
   * **Never transfer-cached.** Availability changes by the minute, and a day list rendered on
   * the server is stale before it paints.
   */
  days(
    query: AvailabilityQuery,
    from: string,
    to: string,
  ): Observable<Result<AvailableDaysResponse>> {
    const params = availabilityParams(query).set('from', from).set('to', to);

    return this.http
      .get<AvailableDaysResponse>(
        this.url(`companies/${encodeURIComponent(query.slug)}/availability/days`),
        { params },
      )
      .pipe(toResult<AvailableDaysResponse>());
  }

  /** The bookable times on one shop-local day. Never transfer-cached, for the reason above. */
  slots(query: AvailabilityQuery, date: string): Observable<Result<DayAvailabilityResponse>> {
    const params = availabilityParams(query).set('date', date);

    return this.http
      .get<DayAvailabilityResponse>(
        this.url(`companies/${encodeURIComponent(query.slug)}/availability/slots`),
        { params },
      )
      .pipe(toResult<DayAvailabilityResponse>(), map(noContentAsEmpty(date)));
  }

  /**
   * The days that can take a move of the caller's own appointment. The same query and shape as
   * {@link days}, except that the appointment's current time counts as free and its services
   * keep their booked length with the same barber.
   */
  rescheduleDays(
    appointmentId: string,
    query: AvailabilityQuery,
    from: string,
    to: string,
  ): Observable<Result<AvailableDaysResponse>> {
    const params = availabilityParams(query).set('from', from).set('to', to);

    return this.http
      .get<AvailableDaysResponse>(
        this.url(`users/me/appointments/${encodeURIComponent(appointmentId)}/availability/days`),
        { params },
      )
      .pipe(toResult<AvailableDaysResponse>());
  }

  /** The times on one day that can take a move. See {@link rescheduleDays}. */
  rescheduleSlots(
    appointmentId: string,
    query: AvailabilityQuery,
    date: string,
  ): Observable<Result<DayAvailabilityResponse>> {
    const params = availabilityParams(query).set('date', date);

    return this.http
      .get<DayAvailabilityResponse>(
        this.url(`users/me/appointments/${encodeURIComponent(appointmentId)}/availability/slots`),
        { params },
      )
      .pipe(toResult<DayAvailabilityResponse>(), map(noContentAsEmpty(date)));
  }

  /**
   * Books it.
   *
   * Every refusal is a designed outcome the page acts on, so read `errorCode` and never the
   * message. `APPOINTMENT_SLOT_TAKEN` in particular is expected traffic: the availability index
   * lags a booking by a few seconds and the database is the real arbiter.
   */
  create(body: CreateAppointmentRequest): Observable<Result<AppointmentResponse>> {
    return this.http
      .post<AppointmentResponse>(this.url('users/me/appointments'), body)
      .pipe(toResult<AppointmentResponse>());
  }
}

/**
 * A day with nothing free can arrive as `204 No Content`, which `toResult` reports as success with
 * null data. Every caller wants "no slots", not "no answer".
 */
function noContentAsEmpty(
  date: string,
): (result: Result<DayAvailabilityResponse>) => Result<DayAvailabilityResponse> {
  return (result) =>
    result.isSuccess && result.data === null
      ? Result.Ok<DayAvailabilityResponse>({ date, timezone: '', slots: [] })
      : result;
}

/**
 * The query both availability endpoints share.
 *
 * `staffMemberId` is left out rather than sent empty when the customer asked for Anyone: the
 * server reads an absent parameter as "any barber" and would match an empty one against none.
 */
function availabilityParams(query: AvailabilityQuery): HttpParams {
  let params = new HttpParams().set('serviceIds', query.serviceIds.join(','));
  if (query.staffMemberId !== null) params = params.set('staffMemberId', query.staffMemberId);
  return params;
}

/** The refusals of `POST /users/me/appointments`. The page branches on codes, not messages. */
export const AppointmentErrorCodes = {
  /** Another customer got the slot first. */
  SlotTaken: 'APPOINTMENT_SLOT_TAKEN',
  /** The slot no longer exists — hours, a holiday or time off changed. */
  SlotUnavailable: 'APPOINTMENT_SLOT_UNAVAILABLE',
  /** The named barber is not free, or no longer performs the whole set. */
  StaffUnavailable: 'APPOINTMENT_STAFF_UNAVAILABLE',
  /** A service was deactivated or removed. */
  ServiceUnavailable: 'APPOINTMENT_SERVICE_UNAVAILABLE',
  /** The customer already has an appointment over this time. */
  OverlapsExisting: 'APPOINTMENT_OVERLAPS_EXISTING',
  /** The start is now inside the shop's lead time. */
  LeadTime: 'APPOINTMENT_LEAD_TIME',
  /** Beyond the shop's booking horizon. */
  TooFarAhead: 'APPOINTMENT_TOO_FAR_AHEAD',
  EmailNotVerified: 'APPOINTMENT_EMAIL_NOT_VERIFIED',
  CustomerBanned: 'APPOINTMENT_CUSTOMER_BANNED',
  /** This shop blocked the person from booking online. The page never says "blocked". */
  CustomerBlockedByShop: 'APPOINTMENT_CUSTOMER_BLOCKED_BY_SHOP',
  InvalidServices: 'APPOINTMENT_INVALID_SERVICES',
} as const;
