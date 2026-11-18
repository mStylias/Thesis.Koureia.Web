import { HttpClient } from '@angular/common/http';
import { Service, inject } from '@angular/core';
import { map, type Observable } from 'rxjs';
import { injectSynaxUrl, toODataResult, toResult } from '@synax/client';
import {
  odataQueryString,
  Result,
  type ODataPage,
  type ODataQuery,
  type ODataResult,
  type ODataRow,
} from '@synax/client/core';

import {
  appointmentsFilter,
  customerAppointmentsFilter,
  dayCountsApply,
} from './appointments.query';
import type {
  AppointmentCatalogResponse,
  AppointmentCheckResponse,
  AppointmentDayCount,
  AppointmentDetailsResponse,
  AppointmentODataResponse,
  AppointmentsQuery,
  AvailableDaysResponse,
  CalendarOptionsResponse,
  CancelAppointmentRequest,
  ChangeAppointmentStatusRequest,
  CheckAppointmentRequest,
  CreateAppointmentRequest,
  CustomerAccountLookupResponse,
  CustomerOptionODataResponse,
  DayAvailabilityResponse,
  FindCustomerAccountRequest,
  ListAppointmentDaysRequest,
  ListAppointmentSlotsRequest,
  ServiceOptionODataResponse,
  UpdateAppointmentRequest,
} from './appointments.types';

/**
 * The shop's appointment book, as the management calendar reads it.
 *
 * ```ts
 * const rows = await firstValueFrom(api.appointments(query, 'el', ['id', 'localDate']));
 * ```
 *
 * The API resolves the shop from the signed-in user. Every read needs `appointments:read_all`
 * there. A write names its own code. Failures arrive as a failed `Result`, never as a thrown
 * error.
 *
 * Query strings are appended to the URL, never handed to `params`: those would encode them a
 * second time.
 */
@Service()
export class AppointmentsApi {
  private readonly http = inject(HttpClient);
  private readonly url = injectSynaxUrl();

  /** Time zone, weekly hours, staff roster and service categories. */
  calendarOptions(languageCode: string): Observable<Result<CalendarOptionsResponse>> {
    return this.http
      .get<CalendarOptionsResponse>(
        this.url('appointments/calendar-options') +
          `?languageCode=${encodeURIComponent(languageCode)}`,
      )
      .pipe(toResult<CalendarOptionsResponse>());
  }

  /**
   * Every appointment that matches, in one response. The endpoint has no page size.
   *
   * `select` names the members to read, sent as `$select`. The row carries prices and contact
   * details, so a caller asks only for the members it shows.
   */
  appointments<K extends keyof AppointmentODataResponse>(
    query: AppointmentsQuery,
    languageCode: string,
    select: readonly K[],
  ): Observable<Result<readonly Pick<AppointmentODataResponse, K>[]>> {
    const search =
      `?languageCode=${encodeURIComponent(languageCode)}` +
      `&$filter=${encodeURIComponent(appointmentsFilter(query))}` +
      `&$select=${encodeURIComponent(select.join(','))}`;
    return this.http
      .get<ODataPage<Pick<AppointmentODataResponse, K>>>(this.url('appointments/odata') + search)
      .pipe(
        toODataResult<Pick<AppointmentODataResponse, K>>(),
        map((result) =>
          Result.map(result, (page): readonly Pick<AppointmentODataResponse, K>[] => page.items),
        ),
      );
  }

  /** How many appointments match on each day of the range. Days with none are absent. */
  dayCounts(query: AppointmentsQuery): Observable<Result<readonly AppointmentDayCount[]>> {
    const search = `?$apply=${encodeURIComponent(dayCountsApply(query))}`;
    return this.http
      .get<ODataPage<AppointmentDayCount>>(this.url('appointments/odata') + search)
      .pipe(
        toODataResult<AppointmentDayCount>(),
        map((result) => Result.map(result, (page): readonly AppointmentDayCount[] => page.items)),
      );
  }

  /**
   * One window of the shop's customers, for an OData data source.
   *
   * The server folds the `$search` term, but Postgres lowercases a capital `Σ` to `σ` and never
   * to the final `ς`. So `ΓΙΩΡΓΟΣ` misses `Γιώργος` unless the caller folds the term first.
   */
  customers(
    query: ODataQuery<CustomerOptionODataResponse>,
  ): Observable<Result<ODataResult<ODataRow>>> {
    return this.http
      .get<ODataPage<ODataRow>>(this.url('appointments/customers/odata') + odataQueryString(query))
      .pipe(toODataResult<ODataRow>());
  }

  /**
   * Whether an account holds the whole address, for the walk-in form's hint. It never says
   * whose. `appointments:create`, 20 calls a minute: `CUSTOMER_LOOKUP_RATE_LIMITED` past that.
   */
  findCustomerAccount(
    request: FindCustomerAccountRequest,
  ): Observable<Result<CustomerAccountLookupResponse>> {
    return this.http
      .post<CustomerAccountLookupResponse>(
        this.url('appointments/customers/account-lookup'),
        request,
      )
      .pipe(toResult<CustomerAccountLookupResponse>());
  }

  /**
   * One page of the shop's book, for an OData data source: the appointments grid.
   *
   * `languageCode` names the services. It goes first, and the source's own query string is
   * appended to it rather than handed to `params`, which would encode it a second time.
   */
  grid(
    query: ODataQuery<AppointmentODataResponse>,
    languageCode: string,
  ): Observable<Result<ODataResult<ODataRow>>> {
    return this.http
      .get<ODataPage<ODataRow>>(
        this.url('appointments/odata') + withLanguage(odataQueryString(query), languageCode),
      )
      .pipe(toODataResult<ODataRow>());
  }

  /** One window of the shop's services, inactive ones included, for an OData data source. */
  services(
    query: ODataQuery<ServiceOptionODataResponse>,
    languageCode: string,
  ): Observable<Result<ODataResult<ODataRow>>> {
    return this.http
      .get<ODataPage<ODataRow>>(
        this.url('appointments/services/odata') +
          withLanguage(odataQueryString(query), languageCode),
      )
      .pipe(toODataResult<ODataRow>());
  }

  /**
   * One customer's latest appointments at the shop, newest first, with the members `select`
   * names.
   */
  customerAppointments<K extends keyof AppointmentODataResponse>(
    customerId: string,
    languageCode: string,
    top: number,
    select: readonly K[],
  ): Observable<Result<readonly Pick<AppointmentODataResponse, K>[]>> {
    const search =
      `?languageCode=${encodeURIComponent(languageCode)}` +
      `&$filter=${encodeURIComponent(customerAppointmentsFilter(customerId))}` +
      `&$orderby=${encodeURIComponent('localDate desc,localStartTime desc')}` +
      `&$top=${top.toString()}` +
      `&$select=${encodeURIComponent(select.join(','))}`;
    return this.http
      .get<ODataPage<Pick<AppointmentODataResponse, K>>>(this.url('appointments/odata') + search)
      .pipe(
        toODataResult<Pick<AppointmentODataResponse, K>>(),
        map((result) =>
          Result.map(result, (page): readonly Pick<AppointmentODataResponse, K>[] => page.items),
        ),
      );
  }

  /** One appointment, with its notes and each service's price. */
  appointment(id: string, languageCode: string): Observable<Result<AppointmentDetailsResponse>> {
    return this.http
      .get<AppointmentDetailsResponse>(
        this.url(`appointments/${encodeURIComponent(id)}`) + lang(languageCode),
      )
      .pipe(toResult<AppointmentDetailsResponse>());
  }

  /** The active services and each active barber's offerings, for a create or an edit. */
  bookingCatalog(languageCode: string): Observable<Result<AppointmentCatalogResponse>> {
    return this.http
      .get<AppointmentCatalogResponse>(
        this.url('appointments/booking-catalog') + lang(languageCode),
      )
      .pipe(toResult<AppointmentCatalogResponse>());
  }

  /** What is unusual about a proposed time. A read with a body: it changes nothing. */
  check(request: CheckAppointmentRequest): Observable<Result<AppointmentCheckResponse>> {
    return this.http
      .post<AppointmentCheckResponse>(this.url('appointments/check'), request)
      .pipe(toResult<AppointmentCheckResponse>());
  }

  /** How full each day in a range is for a staff booking, worked out when asked. */
  days(request: ListAppointmentDaysRequest): Observable<Result<AvailableDaysResponse>> {
    const query = [
      `from=${encodeURIComponent(request.from)}`,
      `to=${encodeURIComponent(request.to)}`,
      `serviceIds=${request.serviceIds.map(encodeURIComponent).join(',')}`,
      ...(request.staffMemberId === null
        ? []
        : [`staffMemberId=${encodeURIComponent(request.staffMemberId)}`]),
      ...(request.customerId === null
        ? []
        : [`customerId=${encodeURIComponent(request.customerId)}`]),
      ...(request.appointmentId === null
        ? []
        : [`appointmentId=${encodeURIComponent(request.appointmentId)}`]),
    ].join('&');
    return this.http
      .get<AvailableDaysResponse>(this.url('appointments/days') + `?${query}`)
      .pipe(toResult<AvailableDaysResponse>());
  }

  /** The free times on one day for a staff booking, worked out when asked. */
  slots(request: ListAppointmentSlotsRequest): Observable<Result<DayAvailabilityResponse>> {
    const query = [
      `localDate=${encodeURIComponent(request.localDate)}`,
      `serviceIds=${request.serviceIds.map(encodeURIComponent).join(',')}`,
      ...(request.staffMemberId === null
        ? []
        : [`staffMemberId=${encodeURIComponent(request.staffMemberId)}`]),
      ...(request.customerId === null
        ? []
        : [`customerId=${encodeURIComponent(request.customerId)}`]),
    ].join('&');
    return this.http
      .get<DayAvailabilityResponse>(this.url('appointments/slots') + `?${query}`)
      .pipe(
        toResult<DayAvailabilityResponse>(),
        // `toResult` reads a `204` as success with no data. The caller wants an empty day.
        map((result) =>
          result.isSuccess && result.data === null
            ? Result.Ok<DayAvailabilityResponse>({
                date: request.localDate,
                timezone: '',
                slots: [],
              })
            : result,
        ),
      );
  }

  /** Books an appointment for a customer, or for a walk-in it creates. `appointments:create`. */
  create(
    request: CreateAppointmentRequest,
    languageCode: string,
  ): Observable<Result<AppointmentDetailsResponse>> {
    return this.http
      .post<AppointmentDetailsResponse>(this.url('appointments') + lang(languageCode), request)
      .pipe(toResult<AppointmentDetailsResponse>());
  }

  /** A merge patch: an absent member is unchanged. `appointments:update`. */
  update(
    id: string,
    request: UpdateAppointmentRequest,
    languageCode: string,
  ): Observable<Result<AppointmentDetailsResponse>> {
    return this.http
      .patch<AppointmentDetailsResponse>(
        this.url(`appointments/${encodeURIComponent(id)}`) + lang(languageCode),
        request,
        { headers: { 'Content-Type': 'application/merge-patch+json' } },
      )
      .pipe(toResult<AppointmentDetailsResponse>());
  }

  /** Confirm, complete, no-show, or restore to confirmed. `appointments:update`. */
  changeStatus(
    id: string,
    request: ChangeAppointmentStatusRequest,
    languageCode: string,
  ): Observable<Result<AppointmentDetailsResponse>> {
    return this.http
      .post<AppointmentDetailsResponse>(
        this.url(`appointments/${encodeURIComponent(id)}/status`) + lang(languageCode),
        request,
      )
      .pipe(toResult<AppointmentDetailsResponse>());
  }

  /** Cancels and frees the slot. `appointments:cancel`. */
  cancel(
    id: string,
    request: CancelAppointmentRequest,
    languageCode: string,
  ): Observable<Result<AppointmentDetailsResponse>> {
    return this.http
      .post<AppointmentDetailsResponse>(
        this.url(`appointments/${encodeURIComponent(id)}/cancel`) + lang(languageCode),
        request,
      )
      .pipe(toResult<AppointmentDetailsResponse>());
  }
}

function lang(languageCode: string): string {
  return `?languageCode=${encodeURIComponent(languageCode)}`;
}

/** An OData query string with `languageCode` beside it. `query` is `''` or starts with `?`. */
function withLanguage(query: string, languageCode: string): string {
  const language = `languageCode=${encodeURIComponent(languageCode)}`;
  return query === '' ? `?${language}` : `${query}&${language}`;
}
