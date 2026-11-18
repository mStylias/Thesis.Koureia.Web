import type { CollectRowsOptions } from './collect-rows.types';

/** Thrown when the abort signal fires. Named so callers can tell it apart. */
export function exportAbortError(): Error {
  const error = new Error('Export canceled');
  error.name = 'AbortError';
  return error;
}

/** True for the error {@link collectExportRows} throws on cancellation. */
export function isAbortError(cause: unknown): boolean {
  return cause instanceof Error && cause.name === 'AbortError';
}

/**
 * Fetches every row of the current query.
 *
 * Progress is reported after each page rather than per row: the numbers exist
 * to drive a progress bar, and a bar cannot show more than one update per
 * frame anyway.
 */
export async function collectExportRows<TRow>(
  options: CollectRowsOptions<TRow>,
): Promise<readonly TRow[]> {
  const pageSize = Math.max(1, Math.floor(options.pageSize));
  const maxRows = options.maxRows ?? Number.POSITIVE_INFINITY;
  const rows: TRow[] = [];
  let total: number | undefined;
  let skip = 0;
  // Read through a call, not through the property: the signal is aborted by
  // something outside this loop, so a narrowed property would be read once and
  // believed for the rest of the fetch.
  const aborted = (): boolean => options.signal?.aborted ?? false;

  for (;;) {
    if (aborted()) {
      throw exportAbortError();
    }
    const take = Math.min(pageSize, maxRows - rows.length);
    if (take <= 0) {
      break;
    }
    const page = await options.load(skip, take);
    if (aborted()) {
      throw exportAbortError();
    }
    if (page.totalCount != null) {
      total = page.totalCount;
    }
    rows.push(...page.rows);
    options.onProgress?.(rows.length, total);
    // A short page is the end of the result. A source that ignores paging
    // answers with everything on the first call and ends here too.
    if (page.rows.length < take) {
      break;
    }
    skip += page.rows.length;
    if (total != null && rows.length >= total) {
      break;
    }
  }
  return rows;
}
