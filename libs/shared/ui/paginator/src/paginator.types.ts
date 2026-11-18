/**
 * A composable piece of the paginator. The `layout` input is an ordered
 * list of these tokens, so consumers control both which controls appear
 * and the order they appear in — no magic strings, no fixed arrangement.
 *
 * - `first` / `prev` / `next` / `last` — the boundary/step nav buttons.
 * - `pages` — the numbered page links (with boundary + ellipsis windowing).
 * - `rowsPerPage` — a dropdown of `rowsPerPageOptions` (page size).
 * - `currentReport` — the "{currentPage} of {totalPages}" status text.
 * - `jumpToPageInput` — a number input to type a page and jump to it.
 * - `jumpToPageDropdown` — a dropdown listing every page.
 */
export type PaginatorSection =
  | 'first'
  | 'prev'
  | 'pages'
  | 'next'
  | 'last'
  | 'rowsPerPage'
  | 'currentReport'
  | 'jumpToPageInput'
  | 'jumpToPageDropdown';

/**
 * The full pagination state, emitted on `(paginate)` and passed as the
 * `$implicit` context to every template slot. (Not `(pageChange)` — that
 * belongs to the `[(page)]` model and carries the page number.)
 *
 * `first`/`last` are array indices for slicing the current page directly:
 * `rows.slice(state.first, state.last)`.
 */
export interface PaginatorState {
  /** Current page, 1-based. */
  readonly page: number;
  /** Rows shown per page. */
  readonly rows: number;
  /** Zero-based index of the first row on this page (inclusive). */
  readonly first: number;
  /** Index just past the last row on this page (exclusive, clamped to total). */
  readonly last: number;
  /** Total number of pages (at least 1, even when empty). */
  readonly pageCount: number;
  /** Total number of records across all pages. */
  readonly totalRecords: number;
}

/** One rendered entry in the numbered page-link strip. */
export type PageItem =
  | { readonly type: 'page'; readonly page: number }
  | { readonly type: 'ellipsis' };

/**
 * Builds the numbered page-link strip with a boundary + ellipsis layout:
 * the first and last pages are always shown, with a sliding window of
 * `visible` links centred on the current page and `…` filling the gaps
 * (e.g. `1 … 4 5 6 … 20`).
 *
 * @param current  the active page (1-based)
 * @param pageCount total number of pages
 * @param visible  target width of the centred window (min 1)
 */
export function buildPageItems(current: number, pageCount: number, visible: number): PageItem[] {
  if (pageCount <= 1) {
    return pageCount === 1 ? [{ type: 'page', page: 1 }] : [];
  }

  const window = Math.max(1, Math.floor(visible));

  // Few enough pages to show them all — no boundaries or ellipses needed.
  if (pageCount <= window + 2) {
    return Array.from({ length: pageCount }, (_, i) => ({
      type: 'page' as const,
      page: i + 1,
    }));
  }

  const half = Math.floor(window / 2);
  let start = Math.max(current - half, 1);
  let end = start + window - 1;
  if (end >= pageCount) {
    end = pageCount;
    start = end - window + 1;
  }
  // Keep at least page 1 and the last page as boundaries.
  start = Math.max(start, 1);

  const items: PageItem[] = [];

  if (start > 1) {
    items.push({ type: 'page', page: 1 });
    // A gap only when there's a page hidden between 1 and the window start.
    if (start > 2) {
      items.push({ type: 'ellipsis' });
    }
  }

  for (let page = start; page <= end; page++) {
    items.push({ type: 'page', page });
  }

  if (end < pageCount) {
    if (end < pageCount - 1) {
      items.push({ type: 'ellipsis' });
    }
    items.push({ type: 'page', page: pageCount });
  }

  return items;
}
