import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { isPlatformBrowser } from '@angular/common';
import { PLATFORM_ID, REQUEST_CONTEXT, Service, inject } from '@angular/core';
import { Observable, Subject, finalize, map, of, shareReplay, takeUntil, tap } from 'rxjs';

import { readAuthRequestContext } from './auth-session.types';

const REFRESH_WINDOW_SECONDS = 30;

interface AccessTokenResponse {
  readonly accessToken: string;
  readonly expiresAt: number;
}

/** Keeps the short-lived API token in this tab only. */
@Service()
export class AccessTokenStore {
  private readonly http = inject(HttpClient);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private readonly sessionExpiredSubject = new Subject<void>();
  private readonly cleared = new Subject<void>();

  private token: AccessTokenResponse | null = readServerToken(inject(REQUEST_CONTEXT));
  private request: Observable<string> | undefined;

  readonly sessionExpired = this.sessionExpiredSubject.asObservable();

  getAccessToken(): Observable<string> {
    const token = this.token;
    if (
      token !== null &&
      (!this.isBrowser || token.expiresAt > currentEpochSeconds() + REFRESH_WINDOW_SECONDS)
    ) {
      return of(token.accessToken);
    }

    if (!this.isBrowser) return of(token?.accessToken ?? '');
    if (this.request !== undefined) return this.request;

    this.request = this.http.get<AccessTokenResponse>('/auth/token').pipe(
      tap((response) => {
        this.token = response;
      }),
      map((response) => response.accessToken),
      tap({
        error: (error: unknown) => {
          this.token = null;
          if (error instanceof HttpErrorResponse && error.status === 401) {
            this.sessionExpiredSubject.next();
          }
        },
      }),
      takeUntil(this.cleared),
      finalize(() => {
        this.request = undefined;
      }),
      shareReplay({ bufferSize: 1, refCount: false }),
    );

    return this.request;
  }

  /**
   * Drops the cached token so the next call fetches a fresh one. For a session that continues
   * with new claims, such as an address that has just been verified.
   *
   * Not {@link clear}: that ends every in-flight request, which is right when the session is
   * over and wrong when it is only newer.
   */
  invalidate(): void {
    this.token = null;
  }

  clear(): void {
    this.token = null;
    this.cleared.next();
  }
}

function readServerToken(context: unknown): AccessTokenResponse | null {
  const session = readAuthRequestContext(context)?.session;
  return session === null || session === undefined
    ? null
    : { accessToken: session.at, expiresAt: session.exp };
}

function currentEpochSeconds(): number {
  return Math.floor(Date.now() / 1000);
}
