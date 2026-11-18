import { HttpClient } from '@angular/common/http';
import { Service, inject } from '@angular/core';
import type { Observable } from 'rxjs';
import { injectSynaxUrl, toODataResult } from '@synax/client';
import {
  odataQueryString,
  type ODataPage,
  type ODataQuery,
  type ODataResult,
  type ODataRow,
  type Result,
} from '@synax/client/core';

import type { CompanyODataResponse } from './platform-companies.types';

/** Every shop on the platform. Only a superadmin can read it. */
@Service()
export class PlatformCompaniesApi {
  private readonly http = inject(HttpClient);
  private readonly url = injectSynaxUrl();

  /**
   * One window of the shops, for an OData data source. The endpoint has no `$search`.
   *
   * The query string is appended to the URL. `params` would encode it a second time.
   */
  companies(
    query: ODataQuery<CompanyODataResponse>,
    languageCode: string,
  ): Observable<Result<ODataResult<ODataRow>>> {
    const language = `languageCode=${encodeURIComponent(languageCode)}`;
    const search = odataQueryString(query);
    return this.http
      .get<ODataPage<ODataRow>>(
        this.url('platform/companies/odata') +
          (search === '' ? `?${language}` : `${search}&${language}`),
      )
      .pipe(toODataResult<ODataRow>());
  }
}
