import { HttpResponse } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { HttpError, Result } from '@synax/client/core';
import { tryAsHttpError } from './http-error-mapping';

/**
 * Turns an `HttpClient` call into a `Result` stream that never errors for an HTTP failure. It
 * mirrors a Synax handler's `Result<TData, HttpError>`.
 *
 * ```ts
 * this.http.get<KeysetPage<BookingResponse, string>>(url, { params })
 *   .pipe(toResult());   // Observable<Result<KeysetPage<...>, HttpError>>
 * ```
 *
 * A `204 No Content`, which has a null body, becomes `Result.Ok(null)`. Only programming
 * errors still propagate as stream errors.
 */
export function toResult<TData>(): (
  source: Observable<TData>,
) => Observable<Result<TData, HttpError>> {
  return (source) =>
    source.pipe(
      map((data) => Result.Ok<TData>(data) as Result<TData, HttpError>),
      catchError((error: unknown) => {
        const httpError = tryAsHttpError(error);
        if (httpError === null) throw error;
        return of<Result<TData, HttpError>>(Result.Fail(httpError));
      }),
    );
}

/** Success payload of `toResultResponse`: the body plus the status and `Location` header. */
export interface ResultResponse<TData> {
  /**
   * The response body, `null` for a `204 No Content`. The wrapper is always present, so
   * `Result.hasData` cannot tell the two apart. Narrow with {@link hasBody}.
   */
  body: TData | null;
  /** The HTTP status code, such as `201`, `200` or `204`. */
  status: number;
  /**
   * The `Location` header, when the server sent one.
   *
   * CAUTION: `Location` is not a CORS-safelisted response header. An API on another origin
   * must send `Access-Control-Expose-Headers: Location`, or the browser hides the header and
   * this field is `undefined` with no error. Same-origin calls, including calls through a
   * dev-server proxy, always see it.
   */
  location?: string;
}

/**
 * Narrows a {@link ResultResponse} to one that carries a body. This is the `200` or `201`
 * against `204` distinction that `Result.hasData` makes for `toResult`.
 *
 * ```ts
 * if (Result.hasData(created) && hasBody(created.data)) {
 *   created.data.body.id;
 *   created.data.location;
 * }
 * ```
 */
export function hasBody<TData>(
  response: ResultResponse<TData>,
): response is ResultResponse<TData> & { body: TData } {
  return response.body !== null;
}

/**
 * `toResult` for calls made with `{ observe: 'response' }`. It exposes the status code and the
 * `Location` header, which endpoints such as `201 Created` need.
 *
 * ```ts
 * this.http.post<BookingResponse>(url, body, { observe: 'response' })
 *   .pipe(toResultResponse());   // Observable<Result<ResultResponse<BookingResponse>, HttpError>>
 * ```
 *
 * The success wrapper is never `null`, so `Result.hasData` narrows away only the unused
 * void-success case. Use {@link hasBody} to test for a body.
 */
export function toResultResponse<TData>(): (
  source: Observable<HttpResponse<TData>>,
) => Observable<Result<ResultResponse<TData>, HttpError>> {
  return (source) =>
    source.pipe(
      map(
        (response) =>
          Result.Ok<ResultResponse<TData>>({
            body: response.body,
            status: response.status,
            location: response.headers.get('Location') ?? undefined,
          }) as Result<ResultResponse<TData>, HttpError>,
      ),
      catchError((error: unknown) => {
        const httpError = tryAsHttpError(error);
        if (httpError === null) throw error;
        return of<Result<ResultResponse<TData>, HttpError>>(Result.Fail(httpError));
      }),
    );
}
