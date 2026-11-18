import { computed, DestroyRef, inject, Service, signal, type Signal } from '@angular/core';

/**
 * What still loads on a page of cards. The page opens at a fragment only when nothing loads, so
 * a card above it cannot grow or go away after the scroll.
 *
 * Provided by the page through `providePageSections`. A card reports with
 * {@link trackPageLoading}.
 */
@Service({ autoProvided: false })
export class PageLoading {
  private readonly sources = signal<readonly Signal<boolean>[]>([]);

  /** Nothing that reports loads now. */
  readonly settled = computed(() => this.sources().every((loading) => !loading()));

  /** Adds a source. The returned function removes it. */
  track(loading: Signal<boolean>): () => void {
    this.sources.update((sources) => [...sources, loading]);
    return () => {
      this.sources.update((sources) => sources.filter((source) => source !== loading));
    };
  }
}

/**
 * Reports a loading state to the page's {@link PageLoading} for the caller's lifetime. Does
 * nothing outside the page, as in a card's own spec.
 */
export function trackPageLoading(loading: Signal<boolean>): void {
  const page = inject(PageLoading, { optional: true });
  if (page === null) return;
  inject(DestroyRef).onDestroy(page.track(loading));
}
