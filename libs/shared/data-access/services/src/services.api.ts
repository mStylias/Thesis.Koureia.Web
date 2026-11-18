import { HttpClient } from '@angular/common/http';
import { Service, inject } from '@angular/core';
import type { Observable } from 'rxjs';
import { injectSynaxUrl, toODataResult, toResult } from '@synax/client';
import {
  odataQueryString,
  type ODataPage,
  type ODataQuery,
  type ODataResult,
  type ODataRow,
  type Result,
} from '@synax/client/core';

import type {
  CreateServiceCategoryRequest,
  CreateServiceRequest,
  ServiceCategoryResponse,
  ServiceODataResponse,
  ServiceOptionsResponse,
  ServiceResponse,
  UpdateServiceCategoryRequest,
  UpdateServiceRequest,
} from './services.types';

/**
 * The shop's service catalog, as the management services page reads and writes it.
 *
 * ```ts
 * const saved = await firstValueFrom(api.updateService(id, request));
 * ```
 *
 * The API resolves the shop from the signed-in user. Reads need `services:read`. A service write
 * names its own code, and every category write needs `services:update`. Failures arrive as a
 * failed `Result`, never as a thrown error.
 *
 * Query strings are appended to the URL, never handed to `params`: those would encode them a
 * second time.
 */
@Service()
export class ServicesApi {
  private readonly http = inject(HttpClient);
  private readonly url = injectSynaxUrl();

  /** One page of the grid, for an OData data source. `languageCode` names the rows. */
  grid(
    query: ODataQuery<ServiceODataResponse>,
    languageCode: string,
  ): Observable<Result<ODataResult<ODataRow>>> {
    return this.http
      .get<ODataPage<ODataRow>>(
        this.url('services/odata') + withLanguage(odataQueryString(query), languageCode),
      )
      .pipe(toODataResult<ODataRow>());
  }

  /** The currency, the languages, the categories and the staff, read once per visit. */
  options(languageCode: string): Observable<Result<ServiceOptionsResponse>> {
    return this.http
      .get<ServiceOptionsResponse>(this.url('services/options') + lang(languageCode))
      .pipe(toResult<ServiceOptionsResponse>());
  }

  /** One service in every language. */
  service(serviceId: string): Observable<Result<ServiceResponse>> {
    return this.http
      .get<ServiceResponse>(this.url(`services/${encodeURIComponent(serviceId)}`))
      .pipe(toResult<ServiceResponse>());
  }

  /** `services:create`. */
  createService(request: CreateServiceRequest): Observable<Result<ServiceResponse>> {
    return this.http
      .post<ServiceResponse>(this.url('services'), request)
      .pipe(toResult<ServiceResponse>());
  }

  /** A full replace: a barber the request leaves out is unassigned. `services:update`. */
  updateService(
    serviceId: string,
    request: UpdateServiceRequest,
  ): Observable<Result<ServiceResponse>> {
    return this.http
      .put<ServiceResponse>(this.url(`services/${encodeURIComponent(serviceId)}`), request)
      .pipe(toResult<ServiceResponse>());
  }

  /** Refused with `SERVICE_IN_USE` once the service is on any appointment. `services:delete`. */
  deleteService(serviceId: string): Observable<Result<null>> {
    return this.http
      .delete<null>(this.url(`services/${encodeURIComponent(serviceId)}`))
      .pipe(toResult<null>());
  }

  /** A shop-owned category. The response's `name` is in `languageCode`. */
  createCategory(
    request: CreateServiceCategoryRequest,
    languageCode: string,
  ): Observable<Result<ServiceCategoryResponse>> {
    return this.http
      .post<ServiceCategoryResponse>(this.url('services/categories') + lang(languageCode), request)
      .pipe(toResult<ServiceCategoryResponse>());
  }

  /** Renames a shop-owned category. A platform one is refused. */
  updateCategory(
    categoryId: string,
    request: UpdateServiceCategoryRequest,
    languageCode: string,
  ): Observable<Result<ServiceCategoryResponse>> {
    return this.http
      .put<ServiceCategoryResponse>(
        this.url(`services/categories/${encodeURIComponent(categoryId)}`) + lang(languageCode),
        request,
      )
      .pipe(toResult<ServiceCategoryResponse>());
  }

  /** Its services become uncategorized. A platform category is refused. */
  deleteCategory(categoryId: string): Observable<Result<null>> {
    return this.http
      .delete<null>(this.url(`services/categories/${encodeURIComponent(categoryId)}`))
      .pipe(toResult<null>());
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
