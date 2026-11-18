import { HttpClient, HttpParams } from '@angular/common/http';
import { Service, inject } from '@angular/core';
import { injectSynaxUrl, toResult } from '@synax/client';
import type { HttpError, Result } from '@synax/client/core';
import type { Observable } from 'rxjs';

import type {
  AppointmentListQuery,
  AppointmentPageResponse,
  AppointmentPriceChange,
  AppointmentResponse,
  CancelCurrentUserAppointmentRequest,
  RescheduleCurrentUserAppointmentRequest,
} from './customer-appointments.api.types';

/**
 * The signed-in customer's own appointments, across every shop.
 *
 * Every call acts on the caller's data only. Another customer's id answers 404, exactly like a
 * missing one. `languageCode` picks the language of the shop and service names.
 *
 * ```ts
 * import { CustomerAppointmentsApi } from '@api/customer-appointments';
 * ```
 */
@Service()
export class CustomerAppointmentsApi {
  private readonly http = inject(HttpClient);
  private readonly url = injectSynaxUrl();

  /** One page of upcoming or past appointments. Upcoming is soonest first, past newest first. */
  list(query: AppointmentListQuery): Observable<Result<AppointmentPageResponse>> {
    const params = new HttpParams()
      .set('period', query.period)
      .set('page', query.page)
      .set('pageSize', query.pageSize)
      .set('languageCode', query.languageCode);

    return this.http
      .get<AppointmentPageResponse>(this.url('users/me/appointments'), { params })
      .pipe(toResult<AppointmentPageResponse>());
  }

  /** One appointment. A missing one and another customer's fail alike, with `httpCode` 404. */
  get(id: string, languageCode: string): Observable<Result<AppointmentResponse>> {
    return this.http
      .get<AppointmentResponse>(this.url(`users/me/appointments/${encodeURIComponent(id)}`), {
        params: new HttpParams().set('languageCode', languageCode),
      })
      .pipe(toResult<AppointmentResponse>());
  }

  /**
   * Cancels it. Refused with `APPOINTMENT_CHANGE_WINDOW_CLOSED` inside the shop's cutoff, and
   * with `APPOINTMENT_INVALID_TRANSITION` when it is no longer active.
   */
  cancel(
    id: string,
    body: CancelCurrentUserAppointmentRequest,
    languageCode: string,
  ): Observable<Result<AppointmentResponse>> {
    return this.http
      .post<AppointmentResponse>(
        this.url(`users/me/appointments/${encodeURIComponent(id)}/cancel`),
        body,
        { params: new HttpParams().set('languageCode', languageCode) },
      )
      .pipe(toResult<AppointmentResponse>());
  }

  /**
   * Moves it, and may change its services, barber and note in the same step. It stays the same
   * appointment, and the original time is kept until the new one is saved.
   *
   * A different total refuses the move with `APPOINTMENT_PRICE_CHANGED` and changes nothing.
   * {@link readPriceChange} reads the new total from that refusal.
   */
  reschedule(
    id: string,
    body: RescheduleCurrentUserAppointmentRequest,
    languageCode: string,
  ): Observable<Result<AppointmentResponse>> {
    return this.http
      .post<AppointmentResponse>(
        this.url(`users/me/appointments/${encodeURIComponent(id)}/reschedule`),
        body,
        { params: new HttpParams().set('languageCode', languageCode) },
      )
      .pipe(toResult<AppointmentResponse>());
  }
}

/** The refusals of the customer's appointment calls. The page branches on codes, not messages. */
export const CustomerAppointmentErrorCodes = {
  NotFound: 'APPOINTMENT_NOT_FOUND',
  /** Cancel or move inside the shop's cutoff. */
  ChangeWindowClosed: 'APPOINTMENT_CHANGE_WINDOW_CLOSED',
  /** Cancel of an appointment already cancelled, completed or missed. */
  InvalidTransition: 'APPOINTMENT_INVALID_TRANSITION',
  /** Move of an appointment already cancelled, completed or missed. */
  NotEditable: 'APPOINTMENT_NOT_EDITABLE',
  /** The move costs a different total. Nothing changed. */
  PriceChanged: 'APPOINTMENT_PRICE_CHANGED',
  /** The move sent no total. A bug in the app. */
  InvalidExpectedTotal: 'APPOINTMENT_INVALID_EXPECTED_TOTAL',
  /** The reason is over 500 characters. */
  InvalidCancellationReason: 'CANCELLATION_INVALID_REASON',
} as const;

/**
 * The new total an `APPOINTMENT_PRICE_CHANGED` refusal carries, or `null` for any other error.
 * The server puts it in the problem body beside the code.
 */
export function readPriceChange(error: HttpError): AppointmentPriceChange | null {
  if (error.errorCode !== CustomerAppointmentErrorCodes.PriceChanged) return null;

  const raw = error.raw as Partial<Record<string, unknown>> | null | undefined;
  const totalPrice = raw?.['totalPrice'];
  const currency = raw?.['currency'];
  return typeof totalPrice === 'number' && typeof currency === 'string'
    ? { totalPrice, currency }
    : null;
}
