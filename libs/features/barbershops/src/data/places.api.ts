import { HttpClient, HttpParams } from '@angular/common/http';
import { Service, inject, signal } from '@angular/core';
import { injectSynaxUrl, toResult } from '@synax/client';
import type { HttpError, Result } from '@synax/client/core';
import { abortReason, type DataSource, type LoadResult } from '@ui/data-source';

import type { PlaceSearchFailure, PlaceSource, PlaceSuggestionResponse } from './places.api.types';

/**
 * How much has to be typed before a search is worth sending.
 *
 * One character matches most of Greece, and the provider bills per request. The server rejects
 * anything shorter with a `400`, so this is the client half of one agreed rule, not a guess.
 */
export const MIN_PLACE_QUERY_LENGTH = 2;

/** A place search that could not be answered. The kind decides what the user is told. */
export class PlaceSearchError extends Error {
  constructor(readonly kind: Exclude<PlaceSearchFailure, 'throttled'>) {
    super(`Place search failed: ${kind}`);
    this.name = 'PlaceSearchError';
  }
}

/**
 * The public place search.
 *
 * Anonymous, and never cached in the browser: the answer is cached in Postgres on the server
 * for weeks, which is the whole reason this goes through the API rather than straight to the
 * provider.
 */
@Service()
export class PlacesApi {
  private readonly http = inject(HttpClient);
  private readonly url = injectSynaxUrl();

  /**
   * Places matching a partial query, best match first.
   *
   * No bias point is sent. The contract accepts one, but biasing splits the server cache per
   * caller unless it is quantized first, and nothing on this page needs the precision.
   */
  search(
    query: string,
    languageCode: string,
    signal?: AbortSignal,
  ): Promise<Result<PlaceSuggestionResponse[]>> {
    const params = new HttpParams().set('query', query).set('languageCode', languageCode);

    return new Promise<Result<PlaceSuggestionResponse[]>>((resolve, reject) => {
      const subscription = this.http
        .get<PlaceSuggestionResponse[]>(this.url('places'), { params })
        .pipe(toResult<PlaceSuggestionResponse[]>())
        .subscribe({ next: resolve, error: reject });

      // The control supersedes a search on every keystroke. Without this the request runs to
      // completion and is billed for an answer nobody reads.
      signal?.addEventListener(
        'abort',
        () => {
          subscription.unsubscribe();
          reject(abortReason(signal));
        },
        { once: true },
      );
    });
  }
}

/**
 * Wraps the endpoint as the data source the autocomplete consumes.
 *
 * The endpoint is unpaged, so `skip` and `take` are ignored: one query, one answer, and the
 * server decides how many suggestions that is.
 */
export function createPlaceSource(api: PlacesApi, languageCode: () => string): PlaceSource {
  const failure = signal<PlaceSearchFailure | null>(null);
  let lastRows: readonly PlaceSuggestionResponse[] = [];

  const load = async (
    request: Parameters<DataSource<PlaceSuggestionResponse>['load']>[0],
  ): Promise<LoadResult<PlaceSuggestionResponse>> => {
    const query = (request.search ?? '').trim();
    if (query.length < MIN_PLACE_QUERY_LENGTH) {
      failure.set(null);
      lastRows = [];
      return { rows: [] };
    }

    const result = await api.search(query, languageCode(), request.signal);
    if (result.isSuccess) {
      failure.set(null);
      lastRows = result.data ?? [];
      return { rows: lastRows };
    }

    const kind = classifyFailure(result.error);
    failure.set(kind);

    // Being throttled is the visitor typing fast, not a fault, and it must never read as one.
    // Handing back the rows already on screen leaves the panel as the visitor left it.
    if (kind === 'throttled') {
      return { rows: lastRows };
    }

    throw new PlaceSearchError(kind);
  };

  return { source: { load }, failure: failure.asReadonly() };
}

/**
 * What a failed search means to the user.
 *
 * A `404` counts as unavailable, not as a fault: until the endpoint is deployed that is exactly
 * what it is, and the page must say the search is off rather than that something broke.
 */
function classifyFailure(error: HttpError): PlaceSearchFailure {
  if (error.httpCode === 429) return 'throttled';
  if (error.httpCode === 0 || error.httpCode === 404 || error.httpCode === 503) {
    return 'unavailable';
  }
  return 'failed';
}
