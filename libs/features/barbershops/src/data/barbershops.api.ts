import { HttpClient, HttpContext, HttpParams } from '@angular/common/http';
import { Service, inject } from '@angular/core';
import { PUBLIC_TRANSFERABLE } from '@api/core';
import { injectSynaxUrl, toResult } from '@synax/client';
import { Result } from '@synax/client/core';
import { map, type Observable } from 'rxjs';

import type {
  BarbershopFilters,
  CompanyCardResponse,
  CompanyDetailsResponse,
} from './barbershops.api.types';

/** Nothing narrowed. The list's starting point, and what the clear action restores. */
export const NO_FILTERS: BarbershopFilters = { name: '', date: null, origin: null };

/**
 * The public barbershop browse.
 *
 * Anonymous, and **unpaged by contract**: the endpoint is documented "unpaged and uncapped:
 * every match comes back", ordered by distance. That is what lets the page slice its own pages
 * out of one answer, and it is the assumption to recheck if the endpoint ever grows a `$top`.
 */
@Service()
export class BarbershopsApi {
  private readonly http = inject(HttpClient);
  private readonly url = injectSynaxUrl();

  /**
   * The shops that match, nearest first.
   *
   * With no filter set this reads `companies/all`, which the API caches whole in Redis per
   * language. The filtered path cannot be cached that way, so it goes to `companies`. The two
   * return the same shape from the same reader.
   *
   * The response is the same for everyone who asks in one language, so it opts into the
   * transfer cache. Without that the server render of this page is thrown away and refetched
   * the moment the browser takes over.
   */
  list(
    filters: BarbershopFilters,
    languageCode: string,
  ): Observable<Result<CompanyCardResponse[]>> {
    const path = usesCachedList(filters) ? 'companies/all' : 'companies';

    return this.http
      .get<CompanyCardResponse[]>(this.url(path), {
        params: toParams(filters, languageCode),
        context: new HttpContext().set(PUBLIC_TRANSFERABLE, true),
      })
      .pipe(
        toResult<CompanyCardResponse[]>(),
        // An empty list arrives as `204 No Content`, which `toResult` reports as success with
        // null data. Every caller wants "no shops", not "no answer".
        map((result) => (result.isSuccess ? Result.Ok(result.data ?? []) : result)),
      );
  }

  /**
   * One shop's home page. An unknown slug fails with `httpCode` 404.
   *
   * Public and the same for every visitor of one language, so it opts into the transfer cache,
   * for the reason {@link list} gives.
   */
  details(slug: string, languageCode: string): Observable<Result<CompanyDetailsResponse>> {
    return this.http
      .get<CompanyDetailsResponse>(this.url(`companies/${encodeURIComponent(slug)}`), {
        params: new HttpParams().set('languageCode', languageCode),
        context: new HttpContext().set(PUBLIC_TRANSFERABLE, true),
      })
      .pipe(toResult<CompanyDetailsResponse>());
  }
}

/**
 * Whether anything narrows the list.
 *
 * The page reads it: an empty result means something different when a filter caused it. The
 * origin is deliberately not counted — it reorders and never removes, so a list that is empty
 * with an origin set is empty full stop.
 */
export function isFiltered(filters: BarbershopFilters): boolean {
  return filters.name.trim() !== '' || filters.date !== null;
}

/**
 * Whether the cached whole-list answer can serve this request.
 *
 * `companies/all` is cached per language and measured from the configured default, so it
 * cannot answer for an origin the caller chose — asking it would silently return distances
 * from Athens to someone who said they were in Patras.
 */
function usesCachedList(filters: BarbershopFilters): boolean {
  return !isFiltered(filters) && filters.origin === null;
}

/**
 * The query string.
 *
 * An unset filter is left out rather than sent empty. The server drops an absent condition and
 * would match an empty one against every name.
 */
function toParams(filters: BarbershopFilters, languageCode: string): HttpParams {
  let params = new HttpParams().set('languageCode', languageCode);

  const name = filters.name.trim();
  if (name !== '') params = params.set('search', name);
  if (filters.date !== null) params = params.set('date', filters.date);

  // The server takes the pair or neither and rejects a lone one with a 400.
  if (filters.origin !== null) {
    params = params
      .set('latitude', filters.origin.latitude)
      .set('longitude', filters.origin.longitude);
  }

  return params;
}
