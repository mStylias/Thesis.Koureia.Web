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
  BlockCustomerRequest,
  CustomerODataResponse,
  CustomerResponse,
  MergeCustomersRequest,
  UpdateCustomerRequest,
} from './customers.types';

/**
 * The shop's customers, as the management customers page reads and writes them.
 *
 * ```ts
 * const saved = await firstValueFrom(api.update(id, { note: 'Short on the sides' }));
 * ```
 *
 * The API resolves the shop from the signed-in user. Every call needs `customers:read`, and each
 * write names its own code. Failures arrive as a failed `Result`, never as a thrown error.
 *
 * Query strings are appended to the URL, never handed to `params`: those would encode them a
 * second time.
 */
@Service()
export class CustomersApi {
  private readonly http = inject(HttpClient);
  private readonly url = injectSynaxUrl();

  /**
   * One page of the list, for an OData data source. `$top` is at most 100. A `$search` term that
   * holds a digit or an `@` must be one quoted phrase.
   */
  list(query: ODataQuery<CustomerODataResponse>): Observable<Result<ODataResult<ODataRow>>> {
    return this.http
      .get<ODataPage<ODataRow>>(this.url('customers/odata') + odataQueryString(query))
      .pipe(toODataResult<ODataRow>());
  }

  /** `CUSTOMER_NOT_FOUND` also answers a walk-in that was merged away or joined an account. */
  customer(customerId: string): Observable<Result<CustomerResponse>> {
    return this.http
      .get<CustomerResponse>(this.customerUrl(customerId))
      .pipe(toResult<CustomerResponse>());
  }

  /** A merge-patch: send only what changed. `customers:update`. */
  update(customerId: string, request: UpdateCustomerRequest): Observable<Result<CustomerResponse>> {
    return this.http
      .patch<CustomerResponse>(this.customerUrl(customerId), request)
      .pipe(toResult<CustomerResponse>());
  }

  /** Stops online booking at this shop. A blocked customer comes back unchanged. `customers:block`. */
  block(customerId: string, request: BlockCustomerRequest): Observable<Result<CustomerResponse>> {
    return this.http
      .post<CustomerResponse>(`${this.customerUrl(customerId)}/block`, request)
      .pipe(toResult<CustomerResponse>());
  }

  /** An unblocked customer comes back unchanged. `customers:block`. */
  unblock(customerId: string): Observable<Result<CustomerResponse>> {
    return this.http
      .post<CustomerResponse>(`${this.customerUrl(customerId)}/unblock`, null)
      .pipe(toResult<CustomerResponse>());
  }

  /** Two walk-ins into one. Cannot be undone. Answers the kept customer. `customers:merge`. */
  merge(request: MergeCustomersRequest): Observable<Result<CustomerResponse>> {
    return this.http
      .post<CustomerResponse>(this.url('customers/merge'), request)
      .pipe(toResult<CustomerResponse>());
  }

  private customerUrl(customerId: string): string {
    return this.url(`customers/${encodeURIComponent(customerId)}`);
  }
}
