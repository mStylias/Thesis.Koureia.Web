import { HttpErrorResponse, HttpRequest, HttpResponse, HttpHandlerFn } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { Observable, firstValueFrom, of, throwError } from 'rxjs';
import { SYNAX_API_CONFIG } from '@synax/client';

import { AccessTokenStore } from './access-token.store';
import { authTokenInterceptor } from './auth-token.interceptor';
import { SessionStore } from './session-store';

const API = 'http://localhost:7000';
const AUTHORITY = 'http://localhost:7030';

/** Runs the interceptor and hands back the request the backend would have received. */
async function intercept(
  url: string,
  accessToken: string,
  init?: { headers?: Record<string, string>; baseUrl?: string },
): Promise<HttpRequest<unknown>> {
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    providers: [
      {
        provide: SYNAX_API_CONFIG,
        useValue: { baseUrl: init?.baseUrl ?? API, defaultVersion: 1 },
      },
      {
        provide: AccessTokenStore,
        useValue: { getAccessToken: () => of(accessToken) },
      },
      { provide: SessionStore, useValue: { isSignedIn: () => accessToken !== '' } },
    ],
  });

  let seen: HttpRequest<unknown> | undefined;
  const next: HttpHandlerFn = (req): Observable<HttpResponse<unknown>> => {
    seen = req;
    return of(new HttpResponse({ status: 200 }));
  };

  await TestBed.runInInjectionContext(async () => {
    const req = new HttpRequest('GET', url, null, { headers: undefined });
    const withHeaders = init?.headers ? req.clone({ setHeaders: init.headers }) : req;
    await firstValueFrom(authTokenInterceptor(withHeaders, next));
  });

  if (!seen) throw new Error('the interceptor never called next');
  return seen;
}

describe('authTokenInterceptor', () => {
  it('attaches the access token to an API call', async () => {
    const req = await intercept(`${API}/api/v1/users/me`, 'ACCESS-TOKEN');

    expect(req.headers.get('Authorization')).toBe('Bearer ACCESS-TOKEN');
  });

  it('never attaches a token to Keycloak', async () => {
    const req = await intercept(
      `${AUTHORITY}/realms/koureia/protocol/openid-connect/token`,
      'ACCESS-TOKEN',
    );

    expect(req.headers.has('Authorization')).toBe(false);
  });

  it('never attaches a token to a third-party host', async () => {
    const req = await intercept('https://tiles.example.test/style.json', 'ACCESS-TOKEN');

    expect(req.headers.has('Authorization')).toBe(false);
  });

  it('does not match a host that merely starts with the API origin', async () => {
    const req = await intercept('http://localhost:7000.evil.test/users/me', 'ACCESS-TOKEN');

    expect(req.headers.has('Authorization')).toBe(false);
  });

  it('sends no header at all when signed out, rather than an empty bearer', async () => {
    const req = await intercept(`${API}/api/v1/users/me`, '');

    expect(req.headers.has('Authorization')).toBe(false);
  });

  it('leaves a caller-supplied Authorization header alone', async () => {
    const req = await intercept(`${API}/api/v1/users/me`, 'ACCESS-TOKEN', {
      headers: { Authorization: 'Bearer DELIBERATE' },
    });

    expect(req.headers.get('Authorization')).toBe('Bearer DELIBERATE');
  });

  describe('with no configured base (same-origin deployment)', () => {
    it('attaches the access token to a relative API call', async () => {
      const req = await intercept('/api/v1/users/me', 'ACCESS-TOKEN', { baseUrl: '' });

      expect(req.headers.get('Authorization')).toBe('Bearer ACCESS-TOKEN');
    });

    it('lets the token request itself through untouched', async () => {
      // The store fetches its token through HttpClient. Intercepting that call deadlocks.
      const req = await intercept('/auth/token', 'ACCESS-TOKEN', { baseUrl: '' });

      expect(req.headers.has('Authorization')).toBe(false);
    });
  });

  describe('when the API refuses the session', () => {
    async function interceptRefused(title: string): Promise<ReturnType<typeof vi.fn>> {
      const refresh = vi.fn(() => Promise.resolve(false));
      TestBed.resetTestingModule();
      TestBed.configureTestingModule({
        providers: [
          { provide: SYNAX_API_CONFIG, useValue: { baseUrl: API, defaultVersion: 1 } },
          { provide: AccessTokenStore, useValue: { getAccessToken: () => of('ACCESS-TOKEN') } },
          { provide: SessionStore, useValue: { isSignedIn: () => true, refresh } },
        ],
      });

      const next: HttpHandlerFn = () =>
        throwError(() => new HttpErrorResponse({ status: 401, error: { title } }));

      await TestBed.runInInjectionContext(async () => {
        await expect(
          firstValueFrom(
            authTokenInterceptor(new HttpRequest('GET', `${API}/api/v1/users/me`), next),
          ),
        ).rejects.toBeInstanceOf(HttpErrorResponse);
      });

      return refresh;
    }

    it('refreshes, which ends a session the API revoked', async () => {
      const refresh = await interceptRefused('AUTH_SESSION_REVOKED');

      expect(refresh).toHaveBeenCalledOnce();
    });

    it('leaves any other refusal to the caller', async () => {
      const refresh = await interceptRefused('AUTH_PERMISSION_DENIED');

      expect(refresh).not.toHaveBeenCalled();
    });
  });
});
