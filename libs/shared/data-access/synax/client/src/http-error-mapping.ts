import { HttpErrorResponse } from '@angular/common/http';
import { TimeoutError } from 'rxjs';
import {
  clientSideError,
  HttpError,
  parseHttpError,
  SyntheticErrorCodes,
} from '@synax/client/core';

/**
 * Converts an error the HTTP layer can produce into an `HttpError`. Returns `null` for
 * anything else, which is a programming error, so the caller can rethrow it.
 *
 * - An `HttpErrorResponse` with a 2xx status gives `PARSE_ERROR`. The response arrived but its
 *   body did not parse, and `HttpClient` reports that as an error response.
 * - Any other `HttpErrorResponse` goes to `parseHttpError`.
 * - An RxJS `TimeoutError`, from an app-side `timeout()` in the pipe, gives `TIMEOUT`.
 * - An `AbortError` gives `CANCELLED`.
 *
 * The function unwraps `cause` before it gives up, so a failure that a layer rethrew inside
 * another `Error`, such as Angular's `ResourceWrappedError`, still gives the problem body and
 * not a synthetic code.
 */
export function tryAsHttpError(error: unknown, maxDepth = 5): HttpError | null {
  const classified = classify(error);
  if (classified !== null) return classified;

  const cause = (error as { cause?: unknown } | null | undefined)?.cause;
  if (maxDepth <= 0 || cause === undefined || cause === null || cause === error) return null;
  return tryAsHttpError(cause, maxDepth - 1);
}

function classify(error: unknown): HttpError | null {
  if (error instanceof HttpErrorResponse) {
    if (error.status >= 200 && error.status < 300) {
      return clientSideError(
        SyntheticErrorCodes.ParseError,
        error.message,
        error.error,
        error.status,
      );
    }
    return parseHttpError(error.status, error.error);
  }
  if (error instanceof TimeoutError) {
    return clientSideError(SyntheticErrorCodes.Timeout, 'The request timed out on the client.');
  }
  if (isAbortError(error)) {
    return clientSideError(
      SyntheticErrorCodes.Cancelled,
      'The request was cancelled on the client.',
    );
  }
  return null;
}

/**
 * Conversion for a context that cannot rethrow, such as mapping an `httpResource` or
 * `rxResource` error signal.
 *
 * ```ts
 * bookings = httpResource<KeysetPage<BookingResponse, string>>(() => this.url());
 * bookingsError = computed(() => asHttpError(this.bookings.error()));
 * ```
 *
 * Returns `null` only when there is no error. An error it cannot classify becomes
 * `UNKNOWN_ERROR`, so a switch on `errorCode` always has a case.
 */
export function asHttpError(error: unknown): HttpError | null {
  if (error === null || error === undefined) return null;
  return (
    tryAsHttpError(error) ??
    clientSideError(SyntheticErrorCodes.Unknown, describeError(error), error)
  );
}

/**
 * Describes a thrown value. Only a value with a useful string form gives a description,
 * because an object stringifies to `'[object Object]'` and a user reads that as a bug. The
 * value itself stays on `raw`.
 */
function describeError(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  if (typeof error === 'number' || typeof error === 'boolean' || typeof error === 'bigint') {
    return String(error);
  }
  return 'An unknown error occurred.';
}

function isAbortError(error: unknown): boolean {
  return (
    typeof DOMException !== 'undefined' &&
    error instanceof DOMException &&
    error.name === 'AbortError'
  );
}
