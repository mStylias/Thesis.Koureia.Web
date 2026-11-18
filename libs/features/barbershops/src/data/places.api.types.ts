/**
 * The wire shapes of the place search, `GET /api/v1/places`. Members are the endpoint's,
 * camel-cased.
 */

import type { Signal } from '@angular/core';
import type { DataSource } from '@ui/data-source';

/**
 * What kind of place a suggestion is. A closed set the API owns: anything it cannot map from
 * the provider arrives as `other` rather than being dropped, so this is safe to switch on.
 */
export type PlaceType =
  | 'address'
  | 'street'
  | 'city'
  | 'administrative'
  | 'county'
  | 'country'
  | 'airport'
  | 'train'
  | 'bus'
  | 'townhall'
  | 'other';

/**
 * One place a person can order the list from.
 *
 * `id` is opaque and lives only as long as the answer it came in: it is the suggestion list's
 * key and nothing else. A chosen place travels on as its coordinates — never as this id.
 */
export interface PlaceSuggestionResponse {
  readonly id: string;
  /** The primary line. Never empty. */
  readonly label: string;
  /** The line that tells two places of the same name apart. Empty when none is needed. */
  readonly context: string;
  readonly type: PlaceType;
  readonly latitude: number;
  readonly longitude: number;
  readonly countryCode: string;
  readonly city: string | null;
  readonly region: string | null;
  readonly street: string | null;
  readonly postalCode: string | null;
}

/**
 * Why a place search did not return suggestions.
 *
 * `throttled` is not a failure and never reaches the user as one — the caller holds the
 * suggestions it already has. The other two are told apart because they say different things:
 * `unavailable` is the capability being down and recovers by itself, `failed` is everything
 * else.
 */
export type PlaceSearchFailure = 'throttled' | 'unavailable' | 'failed';

/** A place source, paired with why its last search came back empty. */
export interface PlaceSource {
  readonly source: DataSource<PlaceSuggestionResponse>;
  /** The last failure, or `null` after any search that answered. */
  readonly failure: Signal<PlaceSearchFailure | null>;
}
