import { signal, type Signal } from '@angular/core';
import type { Result } from '@synax/client/core';
import { firstValueFrom, type Observable } from 'rxjs';

import type { ListPage, PagedList } from './account.types';

/** How many items one page of an account list asks for. */
export const ACCOUNT_PAGE_SIZE = 20;

const EMPTY: PagedList<never> = {
  status: 'idle',
  items: [],
  page: 0,
  hasMore: false,
  loadingMore: false,
  moreFailed: false,
};

/**
 * A list read page by page, with "Show more" appending the next one.
 *
 * Each call to {@link reload} starts over. A response that arrives after a newer reload started
 * is dropped, so a slow first page cannot overwrite a fresh one.
 */
export class PagedListLoader<TItem> {
  private readonly state = signal<PagedList<TItem>>(EMPTY);
  private generation = 0;

  private readonly fetch: (page: number) => Observable<Result<ListPage<TItem>>>;

  readonly list: Signal<PagedList<TItem>> = this.state.asReadonly();

  constructor(fetch: (page: number) => Observable<Result<ListPage<TItem>>>) {
    this.fetch = fetch;
  }

  /** Loads the first page again, from an empty list. */
  async reload(): Promise<void> {
    const generation = ++this.generation;
    this.state.set({ ...EMPTY, status: 'loading' });

    const result = await firstValueFrom(this.fetch(1));
    if (generation !== this.generation) return;

    this.state.set(
      result.isSuccess && result.data !== null
        ? {
            ...EMPTY,
            status: 'ready',
            items: result.data.items,
            page: result.data.page,
            hasMore: result.data.hasMore,
          }
        : { ...EMPTY, status: 'failed' },
    );
  }

  /** Appends the next page. Does nothing while one is in flight or when there is none. */
  async more(): Promise<void> {
    const current = this.state();
    if (current.status !== 'ready' || !current.hasMore || current.loadingMore) return;

    const generation = this.generation;
    this.state.set({ ...current, loadingMore: true, moreFailed: false });

    const result = await firstValueFrom(this.fetch(current.page + 1));
    if (generation !== this.generation) return;

    const latest = this.state();
    this.state.set(
      result.isSuccess && result.data !== null
        ? {
            ...latest,
            items: [...latest.items, ...result.data.items],
            page: result.data.page,
            hasMore: result.data.hasMore,
            loadingMore: false,
          }
        : { ...latest, loadingMore: false, moreFailed: true },
    );
  }

  /** Swaps one item in place, as after an edit the server returned. */
  replace(match: (item: TItem) => boolean, next: TItem): void {
    this.state.update((list) => ({
      ...list,
      items: list.items.map((item) => (match(item) ? next : item)),
    }));
  }

  /** Drops one item, as after a delete. */
  remove(match: (item: TItem) => boolean): void {
    this.state.update((list) => ({ ...list, items: list.items.filter((item) => !match(item)) }));
  }
}
