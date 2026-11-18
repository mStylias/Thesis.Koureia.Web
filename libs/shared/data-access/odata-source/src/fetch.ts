/**
 * Running one request: the Observable-to-promise bridge, and the paging that defeats a
 * server-side `$top` cap.
 */
import { abortReason } from '@ui/data-source';
import type { HttpError, ODataQuery, ODataResult, ODataRow } from '@synax/client/core';
import type { ODataSourceFetch, ResolvedCapabilities } from './options';

/**
 * A failed request, as a rejection the calling store turns into state.
 *
 * The `HttpError` is carried rather than flattened, so a host can read `httpCode` to decide
 * a re-authentication and `validationErrors` to place a message on a field.
 */
export class ODataRequestError extends Error {
  constructor(readonly httpError: HttpError) {
    super(httpError.description ?? httpError.errorCode);
    this.name = 'ODataRequestError';
  }
}

/**
 * Runs one query and resolves the normalized page.
 *
 * Cancellation is the reason this takes an Observable. Unsubscribing is what aborts an
 * in-flight `HttpClient` request, so the signal is wired to `unsubscribe` rather than merely
 * to the promise: a consumer that supersedes a request stops the request, not just its own
 * interest in the answer.
 *
 * A failed `Result` becomes a rejection carrying the `HttpError`. Keeping `Result` out of the
 * data-source contract is what keeps every control free of `@synax`.
 */
export function runQuery<T>(
  fetch: ODataSourceFetch<T>,
  query: ODataQuery<T>,
  signal: AbortSignal | undefined,
): Promise<ODataResult<ODataRow>> {
  if (signal?.aborted === true) {
    return Promise.reject(abortReason(signal));
  }

  return new Promise<ODataResult<ODataRow>>((resolve, reject) => {
    const subscription = fetch(query).subscribe({
      next: (result) => {
        if (result.isSuccess) {
          resolve(result.data ?? { items: [], totalCount: null });
        } else {
          reject(new ODataRequestError(result.error));
        }
      },
      // A fetch built with `toODataResult()` never errors. This is for a hand-written one.
      error: (cause: unknown) => {
        reject(cause instanceof Error ? cause : new Error(String(cause)));
      },
    });

    if (signal === undefined) {
      return;
    }
    const onAbort = (): void => {
      subscription.unsubscribe();
      reject(abortReason(signal));
    };
    signal.addEventListener('abort', onAbort, { once: true });
    // `add` runs on unsubscribe as well as completion, so the listener goes either way.
    subscription.add(() => {
      signal.removeEventListener('abort', onAbort);
    });
  });
}

/** One window of a paged read. */
export interface Window {
  skip: number;
  take?: number;
}

/**
 * Reads a window in server-sized pages and concatenates them.
 *
 * The shared contract says `load` honors the `skip` and `take` it is given. A Synax endpoint
 * caps `$top` at its `MaxTop`, so a larger `take` has to become several requests here. Without
 * that, a full-dataset export asks for 1000 rows, receives the server's 100, reads the short
 * page as the end of the result, and writes a truncated file while reporting success.
 *
 * `totalCount` comes from whichever page carried one — the count is of the filtered set, not
 * of the page, so any page's answer is the answer.
 */
export async function readWindow<T>(
  fetch: ODataSourceFetch<T>,
  build: (window: Window) => ODataQuery<T>,
  window: Window,
  capabilities: ResolvedCapabilities,
  signal: AbortSignal | undefined,
): Promise<{ rows: ODataRow[]; totalCount: number | null; nextLink?: string }> {
  const { maxTop } = capabilities;
  const rows: ODataRow[] = [];
  let totalCount: number | null = null;
  let nextLink: string | undefined;
  let skip = window.skip;
  // An open-ended window still has to be read in server-sized pages; it just has no end
  // other than a short page.
  let remaining = window.take;

  for (;;) {
    const take = remaining === undefined ? maxTop : Math.min(maxTop, remaining);
    if (take <= 0) {
      break;
    }

    const page = await runQuery(fetch, build({ skip, take }), signal);
    // Trimmed to what was asked for. A server that over-answers its own `$top` must not
    // widen the caller's window, and the trim costs nothing when it honors it.
    rows.push(...(page.items.length > take ? page.items.slice(0, take) : page.items));
    if (page.totalCount !== null) {
      totalCount = page.totalCount;
    }
    nextLink = page.nextLink;

    // A short page is the end of the result, whatever the caller still wanted.
    if (page.items.length < take) {
      break;
    }
    skip += take;
    if (remaining !== undefined) {
      remaining -= take;
      if (remaining <= 0) {
        break;
      }
    }
    // An open window that keeps answering with full pages would page forever. The total,
    // once known, is the stopping point.
    if (remaining === undefined && totalCount !== null && skip >= totalCount) {
      break;
    }
  }

  return { rows, totalCount, ...(nextLink === undefined ? {} : { nextLink }) };
}
