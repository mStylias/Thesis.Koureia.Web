import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { injectSynaxUrl, toResult } from '@synax/client';
import { beforeEach, describe, expect, it } from 'vitest';

import { ApiError } from './api-error';
import { provideApi } from './provide-api';

const BASE_URL = 'http://localhost:7000';
const ME = `${BASE_URL}/api/v1/users/me`;
const KEYCLOAK_TOKEN = 'http://localhost:7030/realms/koureia/protocol/openid-connect/token';

describe('apiInterceptor', () => {
  let http: HttpClient;
  let backend: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideApi({ baseUrl: BASE_URL }), provideHttpClientTesting()],
    });
    http = TestBed.inject(HttpClient);
    backend = TestBed.inject(HttpTestingController);
  });

  it('registers a base URL that resolves `users/me` to the versioned route', () => {
    // `provideApi` defaults the version to 1, so no call site repeats `{ version: 1 }`.
    const url = TestBed.runInInjectionContext(() => injectSynaxUrl());
    expect(url('users/me')).toBe(ME);
  });

  describe('error mapping', () => {
    it('turns a problem body into an ApiError carrying its title and status', async () => {
      const failure = firstValueFrom(http.get(ME)).catch((e: unknown) => e);

      backend.expectOne(ME).flush(
        {
          title: 'AUTH_PERMISSION_DENIED',
          status: 403,
          detail: 'You cannot read users.',
          requiredPermission: 'users:read',
          traceId: '00-abc-def-01',
        },
        { status: 403, statusText: 'Forbidden' },
      );

      const error = await failure;
      expect(error).toBeInstanceOf(ApiError);
      expect(error).toMatchObject({
        errorCode: 'AUTH_PERMISSION_DENIED',
        httpCode: 403,
        description: 'You cannot read users.',
        traceId: '00-abc-def-01',
      });
      // Problem extensions stay reachable through `raw`.
      expect((error as ApiError).raw).toMatchObject({ requiredPermission: 'users:read' });
    });

    it('gives a bodiless 401 the synthetic HTTP_401 code', async () => {
      // The auth middleware never reaches a handler, so it writes no body. That is why
      // sign-in state comes from `httpCode` and never from `errorCode`.
      const failure = firstValueFrom(http.get(ME)).catch((e: unknown) => e);
      backend.expectOne(ME).flush(null, { status: 401, statusText: 'Unauthorized' });

      const error = await failure;
      expect(error).toBeInstanceOf(ApiError);
      expect(error).toMatchObject({ errorCode: 'HTTP_401', httpCode: 401 });
      expect((error as ApiError).validationErrors).toEqual([]);
    });

    it('keeps the HttpErrorResponse as `cause`, so toResult still maps it', async () => {
      // Break the cause chain and every `toResult()` call site starts to rethrow.
      const result = firstValueFrom(http.get(ME).pipe(toResult()));
      backend
        .expectOne(ME)
        .flush(
          { title: 'AUTH_EMAIL_NOT_VERIFIED', status: 403 },
          { status: 403, statusText: 'Forbidden' },
        );

      const settled = await result;
      expect(settled.isFailure).toBe(true);
      expect(settled.error).toMatchObject({ errorCode: 'AUTH_EMAIL_NOT_VERIFIED', httpCode: 403 });
      expect(settled.error).not.toBeInstanceOf(ApiError);
    });

    it('surfaces a request that never got a response as NETWORK_ERROR', async () => {
      // What a blocked CORS preflight looks like from inside the app.
      const failure = firstValueFrom(http.get(ME)).catch((e: unknown) => e);
      backend.expectOne(ME).error(new ProgressEvent('error'), { status: 0, statusText: '' });

      expect(await failure).toMatchObject({ errorCode: 'NETWORK_ERROR', httpCode: 0 });
    });
  });

  describe('scoping', () => {
    it('leaves a Keycloak failure as an HttpErrorResponse', async () => {
      const failure = firstValueFrom(http.post(KEYCLOAK_TOKEN, {})).catch((e: unknown) => e);
      backend
        .expectOne(KEYCLOAK_TOKEN)
        .flush({ error: 'invalid_grant' }, { status: 400, statusText: 'Bad Request' });

      const error = await failure;
      expect(error).toBeInstanceOf(HttpErrorResponse);
      expect(error).not.toBeInstanceOf(ApiError);
    });

    it('does not touch withCredentials on a non-API request', () => {
      http.get(KEYCLOAK_TOKEN, { withCredentials: true }).subscribe({ error: () => undefined });
      expect(backend.expectOne(KEYCLOAK_TOKEN).request.withCredentials).toBe(true);
    });
  });

  it('clears withCredentials on an API request', () => {
    // Credentials fail in the browser before a response exists, which reads as an outage.
    http.get(ME, { withCredentials: true }).subscribe({ error: () => undefined });
    expect(backend.expectOne(ME).request.withCredentials).toBe(false);
  });
});
