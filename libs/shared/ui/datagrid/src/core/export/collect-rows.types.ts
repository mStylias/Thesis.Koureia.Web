/** One page of a paged fetch. */
export interface CollectPage<TRow> {
  rows: readonly TRow[];
  /** Total rows matching the query, when the source reports one. */
  totalCount?: number;
}

/** What {@link collectExportRows} is given. */
export interface CollectRowsOptions<TRow> {
  /** Loads one page. The caller closes over the query and the data source. */
  load: (skip: number, take: number) => Promise<CollectPage<TRow>>;
  /** Rows per request. */
  pageSize: number;
  /** Aborts between pages. The page in flight is discarded, not awaited. */
  signal?: AbortSignal;
  /** Called after every page with the rows so far and the total, if known. */
  onProgress?: (loaded: number, total?: number) => void;
  /**
   * Hard stop. A source that keeps answering with full pages would otherwise
   * page forever, and running the browser out of memory is a worse failure
   * than a file the grid reports as incomplete.
   */
  maxRows?: number;
}
