import type { CompanySitemapEntryResponse } from '@features/barbershops';

export interface SitemapShopsOptions {
  /** The API origin, `environment.apiUrl`. */
  readonly apiUrl: string;
  /** Replaces the global `fetch`. For tests. */
  readonly fetch?: typeof fetch;
  /** Replaces `Date.now`. For tests. */
  readonly now?: () => number;
}

/** One answer from the API and when it arrived. */
export interface SitemapShopsCache {
  readonly at: number;
  readonly entries: readonly CompanySitemapEntryResponse[];
}
