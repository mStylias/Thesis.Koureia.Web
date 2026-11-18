import { HttpErrorResponse, HttpInterceptorFn, HttpRequest } from '@angular/common/http';
import { inject } from '@angular/core';
import { throwError } from 'rxjs';
import { catchError, switchMap, take } from 'rxjs/operators';
import { isApiUrl } from '@api/core';
import { SYNAX_API_CONFIG } from '@synax/client';

import { AccessTokenStore } from './access-token.store';
import { SessionStore } from './session-store';

/** The API ended the account's sessions, so the token in hand is refused until it expires. */
const SESSION_REVOKED = 'AUTH_SESSION_REVOKED';

/** Adds the access token only to calls to the configured API. */
export const authTokenInterceptor: HttpInterceptorFn = (req, next) => {
  const baseUrl = inject(SYNAX_API_CONFIG, { optional: true })?.baseUrl;
  if (!isApiUrl(req.url, baseUrl)) return next(req);

  const session = inject(SessionStore);
  if (!session.isSignedIn()) return next(req);

  return inject(AccessTokenStore)
    .getAccessToken()
    .pipe(
      take(1),
      switchMap((token) => next(token ? withBearer(req, token) : req)),
      catchError((error: unknown) => {
        // The refresh fails, since the sessions are gone, and that ends the local session.
        if (isSessionRevoked(error)) void session.refresh();
        return throwError(() => error);
      }),
    );
};

function withBearer(req: HttpRequest<unknown>, token: string): HttpRequest<unknown> {
  // Keep an Authorization header that the caller supplied.
  if (req.headers.has('Authorization')) return req;

  return req.clone({ setHeaders: { Authorization: `Bearer ${token}` } });
}

function isSessionRevoked(error: unknown): boolean {
  return (
    error instanceof HttpErrorResponse &&
    error.status === 401 &&
    (error.error as { title?: unknown } | null)?.title === SESSION_REVOKED
  );
}
