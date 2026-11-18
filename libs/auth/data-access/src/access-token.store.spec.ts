import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { PLATFORM_ID, REQUEST_CONTEXT } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';

import { AccessTokenStore } from './access-token.store';

describe('AccessTokenStore', () => {
  afterEach(() => {
    vi.useRealTimers();
    TestBed.inject(HttpTestingController).verify();
  });

  it('shares one token request between concurrent callers', async () => {
    const store = configure();

    const first = firstValueFrom(store.getAccessToken());
    const second = firstValueFrom(store.getAccessToken());
    TestBed.inject(HttpTestingController)
      .expectOne('/auth/token')
      .flush({ accessToken: 'token', expiresAt: epoch() + 300 });

    await expect(first).resolves.toBe('token');
    await expect(second).resolves.toBe('token');
  });

  it('keeps a token that has more than 30 seconds left', async () => {
    const store = configure();
    const http = TestBed.inject(HttpTestingController);

    const first = firstValueFrom(store.getAccessToken());
    http.expectOne('/auth/token').flush({ accessToken: 'token', expiresAt: epoch() + 31 });
    await first;

    await expect(firstValueFrom(store.getAccessToken())).resolves.toBe('token');
    http.expectNone('/auth/token');
  });

  it('gets a new token when 30 seconds remain', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-10T00:00:00Z'));
    const store = configure();
    const http = TestBed.inject(HttpTestingController);

    const first = firstValueFrom(store.getAccessToken());
    http.expectOne('/auth/token').flush({ accessToken: 'old', expiresAt: epoch() + 30 });
    await first;

    const second = firstValueFrom(store.getAccessToken());
    http.expectOne('/auth/token').flush({ accessToken: 'new', expiresAt: epoch() + 300 });
    await expect(second).resolves.toBe('new');
  });

  it('reports an expired session after a token request returns 401', async () => {
    const store = configure();
    const expired = firstValueFrom(store.sessionExpired);

    const token = firstValueFrom(store.getAccessToken());
    TestBed.inject(HttpTestingController)
      .expectOne('/auth/token')
      .flush({ reason: 'session-expired' }, { status: 401, statusText: 'Unauthorized' });

    await expect(token).rejects.toMatchObject({ status: 401 });
    await expect(expired).resolves.toBeUndefined();
  });

  it('cancels a token request when the session ends', async () => {
    const store = configure();
    const token = firstValueFrom(store.getAccessToken());
    const request = TestBed.inject(HttpTestingController).expectOne('/auth/token');

    store.clear();

    await expect(token).rejects.toMatchObject({ name: 'EmptyError' });
    expect(request.cancelled).toBe(true);
  });

  it('fetches again after the cached token is invalidated', async () => {
    const store = configure();
    const http = TestBed.inject(HttpTestingController);

    const first = firstValueFrom(store.getAccessToken());
    http.expectOne('/auth/token').flush({ accessToken: 'before', expiresAt: epoch() + 300 });
    await first;

    store.invalidate();

    const second = firstValueFrom(store.getAccessToken());
    http.expectOne('/auth/token').flush({ accessToken: 'after', expiresAt: epoch() + 300 });
    await expect(second).resolves.toBe('after');
  });

  // A session that continues with new claims must not lose the request already in flight the
  // way an ended one does.
  it('leaves an in-flight request alone when the token is only invalidated', async () => {
    const store = configure();
    const token = firstValueFrom(store.getAccessToken());
    const request = TestBed.inject(HttpTestingController).expectOne('/auth/token');

    store.invalidate();
    request.flush({ accessToken: 'token', expiresAt: epoch() + 300 });

    // `clear()` would have rejected this with `EmptyError` instead.
    await expect(token).resolves.toBe('token');
  });

  it('uses the request-context token during a server render', async () => {
    const store = configure('server', {
      session: {
        at: 'server-token',
        exp: epoch() + 1,
        sub: 'person-1',
        email: 'person@example.com',
        ev: true,
        gn: 'Given',
        fn: 'Family',
        loc: 'el',
      },
    });

    await expect(firstValueFrom(store.getAccessToken())).resolves.toBe('server-token');
    TestBed.inject(HttpTestingController).expectNone('/auth/token');
  });
});

function configure(platformId = 'browser', requestContext: unknown = null): AccessTokenStore {
  TestBed.configureTestingModule({
    providers: [
      provideHttpClient(),
      provideHttpClientTesting(),
      AccessTokenStore,
      { provide: PLATFORM_ID, useValue: platformId },
      { provide: REQUEST_CONTEXT, useValue: requestContext },
    ],
  });
  return TestBed.inject(AccessTokenStore);
}

function epoch(): number {
  return Math.floor(Date.now() / 1000);
}
