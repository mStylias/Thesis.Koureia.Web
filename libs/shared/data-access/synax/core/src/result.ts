import type { HttpError } from './http-error';

/** A succeeded result. `data` is `null` for a void success, which mirrors `204 No Content`. */
export interface Ok<TData> {
  readonly isSuccess: true;
  readonly isFailure: false;
  readonly data: TData | null;
  readonly error: null;
}

/** A failed result carrying its typed error. */
export interface Fail<TError> {
  readonly isSuccess: false;
  readonly isFailure: true;
  readonly data: null;
  readonly error: TError;
}

/**
 * The client-side mirror of .NET `Result<TData, TError>`: a discriminated union that you read
 * the same way a .NET handler reads a result.
 *
 * ```ts
 * const result = await firstValueFrom(http.post<BookingResponse>(url, body).pipe(toResult()));
 * if (result.isSuccess) {
 *   use(result.data);
 * } else {
 *   switch (result.error.errorCode) { ... }
 * }
 * ```
 *
 * Failures are values, never thrown errors.
 */
export type Result<TData = void, TError = HttpError> = Ok<TData> | Fail<TError>;

export const Result = {
  /** Creates a successful result. Call with no argument for a void success, `data: null`. */
  Ok<TData = void>(data?: TData | null): Ok<TData> {
    return { isSuccess: true, isFailure: false, data: data ?? null, error: null };
  },

  /** Creates a failed result carrying the typed error. */
  Fail<TError>(error: TError): Fail<TError> {
    return { isSuccess: false, isFailure: true, data: null, error };
  },

  /** Narrows to a success with non-null data, which separates a body from a `204`. */
  hasData<TData, TError>(
    result: Result<TData, TError>,
  ): result is Ok<TData> & { readonly data: TData } {
    return result.isSuccess && result.data !== null;
  },

  /** Exhaustive handling of both branches. */
  match<TData, TError, TReturn>(
    result: Result<TData, TError>,
    handlers: {
      ok: (data: TData | null) => TReturn;
      fail: (error: TError) => TReturn;
    },
  ): TReturn {
    return result.isSuccess ? handlers.ok(result.data) : handlers.fail(result.error);
  },

  /** Maps the data of a success. Null data and a failure both pass through unchanged. */
  map<TData, TError, TMapped>(
    result: Result<TData, TError>,
    mapper: (data: TData) => TMapped,
  ): Result<TMapped, TError> {
    if (result.isFailure) return result;
    return Result.Ok<TMapped>(result.data === null ? null : mapper(result.data));
  },
} as const;
