import { computed, signal, Signal } from '@angular/core';
import { Observable, Subscription } from 'rxjs';
import { HttpError, KeysetPage, PagedResult, Result } from '@synax/client/core';

/** Fetches one keyset page, usually an `HttpClient` call piped through `toResult()`. */
export type KeysetFetch<T, TKey> = (
  after: TKey | null,
  pageSize: number,
) => Observable<Result<KeysetPage<T, TKey>, HttpError>>;

/**
 * Signal-based infinite-scroll state over keyset pagination. The library never makes an HTTP
 * call itself. The app supplies the fetch function with its own `HttpClient` call.
 *
 * ```ts
 * readonly bookings = new KeysetPaginator<BookingResponse, string>((after, pageSize) =>
 *   this.http.get<KeysetPage<BookingResponse, string>>(url, {
 *     params: { pageSize, ...(after ? { after } : {}) },
 *   }).pipe(toResult()),
 * );
 * ```
 *
 * `loadMore()` appends the next page and ignores a call made while a load runs. `reset()`
 * cancels any in-flight request and starts again.
 */
export class KeysetPaginator<T, TKey> {
  private readonly _items = signal<readonly T[]>([]);
  private readonly _hasMore = signal(true);
  private readonly _loading = signal(false);
  private readonly _error = signal<HttpError | null>(null);
  private cursor: TKey | null = null;
  private subscription: Subscription | null = null;
  private readonly pageSize: number;

  readonly items: Signal<readonly T[]> = this._items.asReadonly();
  readonly hasMore: Signal<boolean> = this._hasMore.asReadonly();
  readonly loading: Signal<boolean> = this._loading.asReadonly();
  readonly error: Signal<HttpError | null> = this._error.asReadonly();

  constructor(
    private readonly fetch: KeysetFetch<T, TKey>,
    options: { pageSize?: number } = {},
  ) {
    this.pageSize = options.pageSize ?? 20;
  }

  loadMore(): void {
    if (this._loading() || !this._hasMore()) return;

    this._loading.set(true);
    this._error.set(null);
    this.subscription = this.fetch(this.cursor, this.pageSize).subscribe({
      next: (result) => {
        if (result.isSuccess) {
          const page = result.data;
          if (page !== null) {
            this._items.update((items) => [...items, ...page.items]);
            this._hasMore.set(page.hasMore);
            this.cursor = page.nextCursor;
          } else {
            this._hasMore.set(false);
          }
        } else {
          this._error.set(result.error);
        }
        this._loading.set(false);
      },
      // A fetch built with toResult() never errors. This guards a hand-written fetch.
      error: () => {
        this._loading.set(false);
      },
    });
  }

  reset(): void {
    this.subscription?.unsubscribe();
    this.subscription = null;
    this.cursor = null;
    this._items.set([]);
    this._hasMore.set(true);
    this._loading.set(false);
    this._error.set(null);
  }
}

/** Fetches one offset page, usually an `HttpClient` call piped through `toResult()`. */
export type PagedFetch<T> = (
  page: number,
  pageSize: number,
) => Observable<Result<PagedResult<T>, HttpError>>;

/**
 * Signal-based offset-pagination state for a table or a pager. It mirrors the metadata of the
 * server's `PagedResult<T>`. Navigation is imperative, through `goToPage` and `nextPage`, and
 * a new load cancels the in-flight one.
 */
export class PagedSource<T> {
  private readonly _result = signal<PagedResult<T> | null>(null);
  private readonly _page = signal(1);
  private readonly _pageSize = signal(20);
  private readonly _loading = signal(false);
  private readonly _error = signal<HttpError | null>(null);
  private subscription: Subscription | null = null;

  readonly page: Signal<number> = this._page.asReadonly();
  readonly pageSize: Signal<number> = this._pageSize.asReadonly();
  readonly loading: Signal<boolean> = this._loading.asReadonly();
  readonly error: Signal<HttpError | null> = this._error.asReadonly();
  readonly items: Signal<readonly T[]> = computed(() => this._result()?.items ?? []);
  readonly totalCount: Signal<number> = computed(() => this._result()?.totalCount ?? 0);
  readonly totalPages: Signal<number> = computed(() => this._result()?.totalPages ?? 0);
  readonly hasNextPage: Signal<boolean> = computed(() => this._result()?.hasNextPage ?? false);
  readonly hasPreviousPage: Signal<boolean> = computed(
    () => this._result()?.hasPreviousPage ?? false,
  );

  constructor(
    private readonly fetch: PagedFetch<T>,
    options: { page?: number; pageSize?: number } = {},
  ) {
    if (options.page !== undefined) this._page.set(options.page);
    if (options.pageSize !== undefined) this._pageSize.set(options.pageSize);
  }

  /** Loads the current page and cancels any in-flight load. */
  load(): void {
    this.subscription?.unsubscribe();
    this._loading.set(true);
    this._error.set(null);
    this.subscription = this.fetch(this._page(), this._pageSize()).subscribe({
      next: (result) => {
        if (result.isSuccess) {
          this._result.set(result.data);
        } else {
          this._error.set(result.error);
        }
        this._loading.set(false);
      },
      // A fetch built with toResult() never errors. This guards a hand-written fetch.
      error: () => {
        this._loading.set(false);
      },
    });
  }

  goToPage(page: number): void {
    if (page < 1) return;
    this._page.set(page);
    this.load();
  }

  nextPage(): void {
    if (this.hasNextPage()) this.goToPage(this._page() + 1);
  }

  previousPage(): void {
    if (this.hasPreviousPage()) this.goToPage(this._page() - 1);
  }

  /** Changes the page size and reloads from page 1. */
  setPageSize(pageSize: number): void {
    if (pageSize < 1) return;
    this._pageSize.set(pageSize);
    this._page.set(1);
    this.load();
  }

  refresh(): void {
    this.load();
  }
}
