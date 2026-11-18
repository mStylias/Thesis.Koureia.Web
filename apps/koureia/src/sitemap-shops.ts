import type { CompanySitemapEntryResponse } from '@features/barbershops';

import type { SitemapShopsCache, SitemapShopsOptions } from './sitemap-shops.types';

/** How long one answer serves the sitemap. Crawlers read it rarely, and shops change slowly. */
const SITEMAP_SHOPS_TTL_MS = 5 * 60_000;

/** How long the sitemap waits for the API before it answers without the shops. */
const SITEMAP_SHOPS_TIMEOUT_MS = 3_000;

/**
 * Reads the barbershops the sitemap lists, from `GET /api/v1/companies/slugs`.
 *
 * The answer is held for {@link SITEMAP_SHOPS_TTL_MS}. A failure never fails the sitemap: it
 * answers with the last good list, or with none, so the static pages are always listed.
 */
export function createSitemapShops(
  options: SitemapShopsOptions,
): () => Promise<readonly CompanySitemapEntryResponse[]> {
  const fetchFn = options.fetch ?? fetch;
  const now = options.now ?? Date.now;
  let cached: SitemapShopsCache | null = null;

  return async () => {
    if (cached !== null && now() - cached.at < SITEMAP_SHOPS_TTL_MS) return cached.entries;

    try {
      const response = await fetchFn(`${options.apiUrl}/api/v1/companies/slugs`, {
        signal: AbortSignal.timeout(SITEMAP_SHOPS_TIMEOUT_MS),
      });
      if (!response.ok) throw new Error(`HTTP ${String(response.status)}`);

      // The API answers `204 No Content` when there is no shop at all.
      const entries =
        response.status === 204 ? [] : ((await response.json()) as CompanySitemapEntryResponse[]);
      cached = { at: now(), entries };
      return entries;
    } catch (error) {
      console.error('[sitemap] could not read the barbershops', error);
      return cached?.entries ?? [];
    }
  };
}
