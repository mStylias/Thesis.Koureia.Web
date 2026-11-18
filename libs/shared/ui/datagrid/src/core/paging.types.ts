/** How rows are paged through. */
export type PagingMode = 'pager' | 'infinite' | 'none';

/** Everything a pager or a "load more" affordance needs to render. */
export interface PageInfo {
  /** 0-based. */
  pageIndex: number;
  pageSize: number;
  /** `null` when the source does not report a total. */
  total: number | null;
  /** `null` when the total is unknown. */
  pageCount: number | null;
  /** 1-based index of the first row on the page, or `0` when empty. */
  firstRow: number;
  /** 1-based index of the last row on the page. */
  lastRow: number;
  hasPrevious: boolean;
  /**
   * With an unknown total, a full page is assumed to have a successor: that
   * assumption is what lets "load more" work without a count.
   */
  hasNext: boolean;
}
