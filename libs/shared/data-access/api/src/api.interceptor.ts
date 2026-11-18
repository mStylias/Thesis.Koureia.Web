import { HttpInterceptorFn, HttpRequest } from '@angular/common/http';
import { inject, isDevMode } from '@angular/core';
import { throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { SYNAX_API_CONFIG, tryAsHttpError } from '@synax/client';

import { ApiError } from './api-error';
import { isApiUrl } from './api-url';

/**
 * Policy for calls to our own API and nothing else: a failure arrives as {@link ApiError}, and
 * the request never sends `withCredentials`.
 *
 * Register it first in `withInterceptors` so it is outermost. A later interceptor then sees
 * the raw `HttpErrorResponse`, which is what a 401-handling auth interceptor needs, and
 * whatever it lets through is mapped on the way out.
 */
export const apiInterceptor: HttpInterceptorFn = (req, next) => {
  const baseUrl = inject(SYNAX_API_CONFIG, { optional: true })?.baseUrl;
  if (!isApiUrl(req.url, baseUrl)) return next(req);

  return next(withoutCredentials(req)).pipe(
    catchError((error: unknown) => {
      if (error instanceof ApiError) return throwError(() => error);

      const httpError = tryAsHttpError(error);
      // `null` means a programming error thrown through the stream, not an HTTP failure.
      if (httpError === null) return throwError(() => error);

      return throwError(() => new ApiError(httpError, error));
    }),
  );
};

function withoutCredentials(req: HttpRequest<unknown>): HttpRequest<unknown> {
  if (!req.withCredentials) return req;

  // The API's CORS policy is DisallowCredentials, so the browser rejects the response before
  // the app sees it, and the failure reads as a status-0 NETWORK_ERROR outage. No call to this
  // API needs credentials, so clear the flag.
  if (isDevMode()) {
    console.warn(
      `[api] withCredentials cleared on ${req.method} ${req.url}; the API disallows credentials.`,
    );
  }
  return req.clone({ withCredentials: false });
}
