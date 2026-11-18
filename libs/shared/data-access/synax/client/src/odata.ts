import { computed, signal, Signal } from '@angular/core';
import { Observable, Subscription } from 'rxjs';
import { map } from 'rxjs/operators';
import {
  Expand,
  Filter,
  HttpError,
  ODataPage,
  odataResult,
  ODataQuery,
  ODataResult,
  OrderBy,
  Result,
  Select,
} from '@synax/client/core';
import { toResult } from './operators';

/**
 * Operator for a Synax OData endpoint, `/search` by convention. It maps the
 * OData envelope to an {@link ODataResult}. It keeps `@odata.context` and `@odata.nextLink` when
 * the server sends them. Like `toResult()`, it never errors for an HTTP failure, so a bad client
 * query arrives as an `HttpError` with the error code `INVALID_ODATA_QUERY`.
 *
 * ```ts
 * this.http.get<ODataPage<RestaurantResponse>>(
 *   this.url('restaurants/search') +
 *     odataQueryString({ filter: { name: { contains: term } }, top: 20, count: true }),
 * ).pipe(toODataResult());   // Observable<Result<ODataResult<RestaurantResponse>, HttpError>>
 * ```
 *
 * Use `ODataPage<ODataRow>` when `$select`, `$expand`, `$apply`, or annotations reshape the rows.
 */
export function toODataResult<T>(): (
  source: Observable<ODataPage<T>>,
) => Observable<Result<ODataResult<T>, HttpError>> {
  return (source) =>
    source.pipe(
      toResult<ODataPage<T>>(),
      map((result) => Result.map(result, odataResult)),
    );
}

/** Fetches one OData window, usually an `HttpClient` call piped through `toODataResult()`. */
export type ODataFetch<T> = (query: ODataQuery<T>) => Observable<Result<ODataResult<T>, HttpError>>;

/**
 * Signal-based pager over an OData endpoint. It is the `$top` and `$skip` counterpart of
 * {@link PagedSource}, and it holds `$filter` and `$orderby` as state. The library never makes
 * an HTTP call itself. The app supplies the fetch.
 *
 * ```ts
 * readonly restaurants = new ODataSource<RestaurantResponse>(query =>
 *   this.http.get<ODataPage<RestaurantResponse>>(
 *     this.url('restaurants/search') + odataQueryString(query),
 *   ).pipe(toODataResult()),
 *   { pageSize: 20, orderBy: 'name' },
 * );
 * restaurants.setFilter({ name: { contains: term } });   // resets to page 1 and reloads
 * ```
 *
 * The source sends `$count=true` by default, which fills `totalCount` and `totalPages`. Pass
 * `{ count: false }` to skip the extra count query. `hasNextPage` then falls back to whether
 * this page came back full. A new load cancels the in-flight one. This class is client-driven and
 * does not follow `@odata.nextLink`; use the normalized result directly for server-driven paging.
 */
export class ODataSource<T> {
  private readonly _items = signal<readonly T[]>([]);
  private readonly _totalCount = signal<number | null>(null);
  private readonly _page = signal(1);
  private readonly _pageSize = signal(20);
  private readonly _filter = signal<Filter<T> | undefined>(undefined);
  private readonly _orderBy = signal<OrderBy<T> | undefined>(undefined);
  private readonly _loading = signal(false);
  private readonly _error = signal<HttpError | null>(null);
  private readonly count: boolean;
  private readonly select?: Select<T>;
  private readonly expand?: Expand<T>;
  private subscription: Subscription | null = null;
  // A signal, not a field: `hasNextPage` depends on it when the total is unknown.
  private readonly _lastPageWasFull = signal(false);

  readonly items: Signal<readonly T[]> = this._items.asReadonly();
  readonly page: Signal<number> = this._page.asReadonly();
  readonly pageSize: Signal<number> = this._pageSize.asReadonly();
  readonly filter: Signal<Filter<T> | undefined> = this._filter.asReadonly();
  readonly orderBy: Signal<OrderBy<T> | undefined> = this._orderBy.asReadonly();
  readonly loading: Signal<boolean> = this._loading.asReadonly();
  readonly error: Signal<HttpError | null> = this._error.asReadonly();

  /** The total across all pages, or `null` when the source was created with `count: false`. */
  readonly totalCount: Signal<number | null> = this._totalCount.asReadonly();

  /** The total page count, `0` while the total is unknown. */
  readonly totalPages: Signal<number> = computed(() => {
    const total = this._totalCount();
    return total === null ? 0 : Math.ceil(total / this._pageSize());
  });

  readonly hasPreviousPage: Signal<boolean> = computed(() => this._page() > 1);

  readonly hasNextPage: Signal<boolean> = computed(() => {
    const total = this._totalCount();
    // Without $count, the only evidence of a next page is that this one came back full.
    if (total === null) return this._lastPageWasFull();
    return this._page() < this.totalPages();
  });

  constructor(
    private readonly fetch: ODataFetch<T>,
    options: {
      page?: number;
      pageSize?: number;
      filter?: Filter<T>;
      orderBy?: OrderBy<T>;
      count?: boolean;
      select?: Select<T>;
      expand?: Expand<T>;
    } = {},
  ) {
    if (options.page !== undefined) this._page.set(options.page);
    if (options.pageSize !== undefined) this._pageSize.set(options.pageSize);
    this._filter.set(options.filter);
    this._orderBy.set(options.orderBy);
    this.count = options.count ?? true;
    this.select = options.select;
    this.expand = options.expand;
  }

  /** The query the next load sends. Use it to build a link or to debug. */
  query(): ODataQuery<T> {
    const pageSize = this._pageSize();
    return {
      filter: this._filter(),
      orderBy: this._orderBy(),
      top: pageSize,
      skip: (this._page() - 1) * pageSize,
      count: this.count,
      select: this.select,
      expand: this.expand,
    };
  }

  /** Loads the current window and cancels any in-flight load. */
  load(): void {
    this.subscription?.unsubscribe();
    this._loading.set(true);
    this._error.set(null);
    this.subscription = this.fetch(this.query()).subscribe({
      next: (result) => {
        if (result.isSuccess) {
          const page = result.data;
          this._items.set(page?.items ?? []);
          this._totalCount.set(page?.totalCount ?? null);
          this._lastPageWasFull.set((page?.items.length ?? 0) >= this._pageSize());
        } else {
          this._error.set(result.error);
        }
        this._loading.set(false);
      },
      // A fetch built with toODataResult() never errors. This guards a hand-written fetch.
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

  /**
   * Replaces `$filter` and reloads from page 1. Pass `undefined` to clear it.
   *
   * Prefer a structured filter such as `{ name: { contains: term } }` to a hand-written
   * string. A structured filter escapes user input instead of concatenating it into the
   * expression.
   */
  setFilter(filter: Filter<T> | undefined): void {
    this._filter.set(filter);
    this._page.set(1);
    this.load();
  }

  /** Replaces `$orderby` and reloads from page 1. Pass `undefined` to clear it. */
  setOrderBy(orderBy: OrderBy<T> | undefined): void {
    this._orderBy.set(orderBy);
    this._page.set(1);
    this.load();
  }

  refresh(): void {
    this.load();
  }
}
