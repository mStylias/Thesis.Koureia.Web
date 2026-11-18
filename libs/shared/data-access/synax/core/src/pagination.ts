/** One page of an offset-paginated query. The wire shape of `PagedResult<T>`. */
export interface PagedResult<T> {
  /** The items on this page. */
  items: T[];
  /** The 1-based page number this result represents. */
  page: number;
  /** The requested page size. The last page can hold fewer items. */
  pageSize: number;
  /** The total number of items across all pages. */
  totalCount: number;
  /** The total number of pages. */
  totalPages: number;
  /** Whether a page exists before this one. */
  hasPreviousPage: boolean;
  /** Whether a page exists after this one. */
  hasNextPage: boolean;
}

/**
 * One page of a keyset-paginated, cursor-based query. The wire shape of
 * `KeysetPage<T, TKey>`. Send `nextCursor` back as the endpoint's `after` parameter to get the
 * next page.
 */
export interface KeysetPage<T, TKey> {
  /** The items on this page, ordered by the paging key. */
  items: T[];
  /** The requested page size. The last page can hold fewer items. */
  pageSize: number;
  /** Whether more items exist after this page. */
  hasMore: boolean;
  /**
   * The paging key of the last item on this page.
   *
   * CAUTION: Read it only when `hasMore` is `true`. On an empty page the server serializes the
   * key type's default. That is `null` for a reference-typed key, but
   * `"00000000-0000-0000-0000-000000000000"` for a `Guid` key.
   */
  nextCursor: TKey | null;
}
