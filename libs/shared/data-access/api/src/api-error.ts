import { HttpError, ValidationError } from '@synax/client/core';

/**
 * A thrown `HttpError`: the API's parsed problem body in a form the error channel can carry,
 * so a `catch` sees `errorCode` and `httpCode` and not a raw `HttpErrorResponse`.
 *
 * WARNING: Keep the original `HttpErrorResponse` as `cause`. `tryAsHttpError`, and thus
 * `toResult()`, classifies by `instanceof` and walks the cause chain when it cannot. Without
 * the cause, every call site that uses `toResult()` starts to rethrow.
 *
 * Only the interceptor constructs this.
 */
export class ApiError extends Error implements HttpError {
  readonly errorCode: string;
  readonly httpCode: number;
  readonly description?: string;
  readonly validationErrors: ValidationError[];
  readonly traceId?: string;
  readonly raw?: unknown;

  constructor(error: HttpError, cause?: unknown) {
    super(error.description ?? describe(error), { cause });
    this.name = 'ApiError';
    this.errorCode = error.errorCode;
    this.httpCode = error.httpCode;
    this.description = error.description;
    this.validationErrors = error.validationErrors;
    this.traceId = error.traceId;
    this.raw = error.raw;
  }
}

/** The message for a failure that the server did not describe. */
function describe(error: HttpError): string {
  // `HTTP_401 (HTTP 401)` says one thing twice.
  if (error.errorCode === `HTTP_${error.httpCode}`) return error.errorCode;
  if (error.httpCode === 0) return error.errorCode;
  return `${error.errorCode} (HTTP ${error.httpCode})`;
}
