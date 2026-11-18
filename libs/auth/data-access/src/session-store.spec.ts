import { DOCUMENT } from '@angular/common';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { PLATFORM_ID, REQUEST_CONTEXT, TransferState, makeStateKey } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { Subject } from 'rxjs';

import { AccessTokenStore } from './access-token.store';
import { AuthSessionResponse } from './auth-session.types';
import { BEFORE_SIGN_OUT_LIMIT_MS, provideBeforeSignOut } from './before-sign-out';
import type { BeforeSignOut } from './before-sign-out.types';
import { PendingIntentStore } from './pending-intent.store';
import { SessionChannel } from './session-channel';
import { SessionStore } from './session-store';

const transferKey = makeStateKey<AuthSessionResponse>('auth.session');

interface TestContext {
  readonly store: SessionStore;
  readonly tokens: {
    clear: ReturnType<typeof vi.fn>;
    invalidate: ReturnType<typeof vi.fn>;
    sessionExpired: Subject<void>;
  };
  readonly channel: {
    listen: ReturnType<typeof vi.fn>;
    listenChanged: ReturnType<typeof vi.fn>;
    announceEnded: ReturnType<typeof vi.fn>;
    announceChanged: ReturnType<typeof vi.fn>;
  };
  readonly intents: { clear: ReturnType<typeof vi.fn> };
  readonly router: { url: string; navigateByUrl: ReturnType<typeof vi.fn> };
  readonly assign: ReturnType<typeof vi.fn>;
}

describe('SessionStore', () => {
  afterEach(() => {
    TestBed.inject(HttpTestingController).verify();
  });

  it('gets the session from the BFF after a static render', async () => {
    const { store } = configure();

    const bootstrap = store.bootstrap();
    expect(store.status()).toBe('deciding');
    TestBed.inject(HttpTestingController).expectOne('/auth/session').flush(signedInResponse());
    await bootstrap;

    expect(store.status()).toBe('signed-in');
    expect(store.claims()?.givenName).toBe('Given');
  });

  it('uses the hint cookie for the signed-in shape while a static render resolves', async () => {
    const { store } = configure('browser', null, 'theme=dark; ks-hint=1');

    const bootstrap = store.bootstrap();

    expect(store.status()).toBe('signed-in');
    expect(store.claims()).toBeNull();

    TestBed.inject(HttpTestingController).expectOne('/auth/session').flush(signedInResponse());
    await bootstrap;

    expect(store.claims()?.givenName).toBe('Given');
  });

  it('uses transferred server state without a browser request', async () => {
    const context = configure();
    TestBed.inject(TransferState).set(transferKey, signedInResponse());

    await context.store.bootstrap();

    expect(context.store.status()).toBe('signed-in');
    TestBed.inject(HttpTestingController).expectNone('/auth/session');
  });

  it('commits request context before a server render', async () => {
    const context = configure('server', { session: requestSession() });

    await context.store.bootstrap();

    expect(context.store.status()).toBe('signed-in');
    expect(context.store.claims()).toEqual(signedInResponse().claims);
    expect(TestBed.inject(TransferState).get(transferKey, null)).toEqual(signedInResponse());
    TestBed.inject(HttpTestingController).expectNone('/auth/session');
  });

  it('leaves a static server response undecided without transferring it', async () => {
    const context = configure('server', null);

    await context.store.bootstrap();

    expect(context.store.status()).toBe('deciding');
    expect(TestBed.inject(TransferState).hasKey(transferKey)).toBe(false);
  });

  it('starts sign-in through the BFF with the current return URL', () => {
    const context = configure();
    context.router.url = '/el/barbershops?near=me';

    context.store.signIn();

    expect(context.assign).toHaveBeenCalledWith(
      '/auth/sign-in?returnUrl=%2Fel%2Fbarbershops%3Fnear%3Dme',
    );
  });

  it('follows the redirect from a failed provider sign-out', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const context = configure();
    context.router.url = '/el/account';

    const signOut = context.store.signOut();
    TestBed.inject(HttpTestingController)
      .expectOne({ method: 'POST', url: '/auth/sign-out' })
      .flush(
        { redirectTo: '/', reason: 'provider-unavailable' },
        { status: 502, statusText: 'Bad Gateway' },
      );
    await signOut;

    expect(context.channel.announceEnded).toHaveBeenCalledOnce();
    expect(context.tokens.clear).toHaveBeenCalledOnce();
    expect(context.assign).toHaveBeenCalledWith('/el');
  });

  it('signs out into the language the page was read in', async () => {
    const context = configure();
    context.router.url = '/en/account';

    const signOut = context.store.signOut();
    TestBed.inject(HttpTestingController)
      .expectOne({ method: 'POST', url: '/auth/sign-out' })
      .flush({ redirectTo: '/' });
    await signOut;

    // Sign-out clears the language cookie, so a bare `/` would re-negotiate and turn an English
    // reader Greek. A Router navigation would land on the empty root route and render nothing.
    expect(context.assign).toHaveBeenCalledWith('/en');
    expect(context.router.navigateByUrl).not.toHaveBeenCalled();
  });

  it('leaves a sign-out redirect that already names a language alone', async () => {
    const context = configure();
    context.router.url = '/en/account';

    const signOut = context.store.signOut();
    TestBed.inject(HttpTestingController)
      .expectOne({ method: 'POST', url: '/auth/sign-out' })
      .flush({ redirectTo: '/el/goodbye' });
    await signOut;

    expect(context.assign).toHaveBeenCalledWith('/el/goodbye');
  });

  it('runs the sign-out hooks before the session ends', async () => {
    const order: string[] = [];
    const hook = vi.fn(() => {
      order.push('hook');
      return Promise.resolve();
    });
    const context = configure('browser', null, '', [hook]);

    const signOut = context.store.signOut();
    await vi.waitFor(() => {
      expect(hook).toHaveBeenCalledOnce();
    });
    const request = await vi.waitFor(() =>
      TestBed.inject(HttpTestingController).expectOne({ method: 'POST', url: '/auth/sign-out' }),
    );
    order.push('sign-out');
    request.flush({ redirectTo: '/' });
    await signOut;

    expect(order).toEqual(['hook', 'sign-out']);
  });

  it('signs out after the limit when a hook hangs, and when a hook fails', async () => {
    vi.useFakeTimers();
    try {
      const hanging: BeforeSignOut = () => new Promise(() => undefined);
      const failing: BeforeSignOut = () => Promise.reject(new Error('offline'));
      const context = configure('browser', null, '', [hanging, failing]);
      const http = TestBed.inject(HttpTestingController);

      const signOut = context.store.signOut();
      await vi.advanceTimersByTimeAsync(BEFORE_SIGN_OUT_LIMIT_MS - 1);
      http.expectNone('/auth/sign-out');

      await vi.advanceTimersByTimeAsync(1);
      http.expectOne({ method: 'POST', url: '/auth/sign-out' }).flush({ redirectTo: '/' });
      await signOut;

      expect(context.assign).toHaveBeenCalledOnce();
    } finally {
      vi.useRealTimers();
    }
  });

  it('moves the sealed locale claim, and the local copy with it', async () => {
    const context = await signedIn();
    expect(context.store.claims()?.locale).toBe('el');

    const adopting = context.store.adoptLanguage('en');
    const request = TestBed.inject(HttpTestingController).expectOne({
      method: 'POST',
      url: '/auth/language',
    });
    expect(request.request.body).toEqual({ language: 'en' });
    request.flush({ locale: 'en' });
    await adopting;

    // The next page load compares this against the preference cookie. A stale copy gives that
    // comparison a disagreement to act on.
    expect(context.store.claims()?.locale).toBe('en');
  });

  it('stops the local session when another tab signs out', async () => {
    const context = configure();
    const bootstrap = context.store.bootstrap();
    TestBed.inject(HttpTestingController).expectOne('/auth/session').flush(signedInResponse());
    await bootstrap;
    const listener = context.channel.listen.mock.calls[0][0] as () => void;

    listener();

    expect(context.store.status()).toBe('signed-out');
    expect(context.tokens.clear).toHaveBeenCalledOnce();
    expect(context.intents.clear).toHaveBeenCalledOnce();
  });

  it('adopts the refreshed claims, drops the cached token, and tells the other tabs', async () => {
    const context = await signedIn();
    expect(context.store.isEmailVerified()).toBe(false);

    const refresh = context.store.refresh();
    TestBed.inject(HttpTestingController)
      .expectOne({ method: 'POST', url: '/auth/refresh' })
      .flush({ ...signedInResponse(), expiresAt: 1_800_000_000 });

    expect(await refresh).toBe(true);
    expect(context.store.isEmailVerified()).toBe(true);
    // The cached token was signed against the old claims, so it must not serve the next request.
    expect(context.tokens.invalidate).toHaveBeenCalledOnce();
    // Not `clear`: the session continues, it is only newer.
    expect(context.tokens.clear).not.toHaveBeenCalled();
    expect(context.channel.announceChanged).toHaveBeenCalledOnce();
  });

  it('expires the local session when the BFF refuses to refresh', async () => {
    const context = await signedIn();

    const refresh = context.store.refresh();
    TestBed.inject(HttpTestingController)
      .expectOne({ method: 'POST', url: '/auth/refresh' })
      .flush({ reason: 'session-expired' }, { status: 401, statusText: 'Unauthorized' });

    expect(await refresh).toBe(false);
    expect(context.store.status()).toBe('expired');
    expect(context.tokens.clear).toHaveBeenCalledOnce();
  });

  it('re-resolves the session when another tab changed its claims', async () => {
    const context = await signedIn();
    const onChanged = context.channel.listenChanged.mock.calls[0][0] as () => void;

    onChanged();
    TestBed.inject(HttpTestingController).expectOne('/auth/session').flush(signedInResponse());
    await Promise.resolve();

    expect(context.store.isEmailVerified()).toBe(true);
  });
});

/** A signed-in browser session whose address is not yet proven — where verification starts. */
async function signedIn(): Promise<TestContext> {
  const context = configure();
  const bootstrap = context.store.bootstrap();
  TestBed.inject(HttpTestingController)
    .expectOne('/auth/session')
    .flush({
      ...signedInResponse(),
      claims: { ...signedInResponse().claims, emailVerified: false },
    });
  await bootstrap;
  return context;
}

function configure(
  platformId = 'browser',
  requestContext: unknown = null,
  cookie = '',
  hooks: readonly BeforeSignOut[] = [],
): TestContext {
  const expired = new Subject<void>();
  const tokens = { clear: vi.fn(), invalidate: vi.fn(), sessionExpired: expired };
  const channel = {
    listen: vi.fn(),
    listenChanged: vi.fn(),
    announceEnded: vi.fn(),
    announceChanged: vi.fn(),
  };
  const intents = { clear: vi.fn() };
  const router = { url: '/', navigateByUrl: vi.fn(() => Promise.resolve(true)) };
  const assign = vi.fn();

  TestBed.configureTestingModule({
    providers: [
      provideHttpClient(),
      provideHttpClientTesting(),
      SessionStore,
      { provide: PLATFORM_ID, useValue: platformId },
      { provide: REQUEST_CONTEXT, useValue: requestContext },
      { provide: AccessTokenStore, useValue: tokens },
      { provide: SessionChannel, useValue: channel },
      { provide: PendingIntentStore, useValue: intents },
      { provide: Router, useValue: router },
      ...hooks.map((hook) => provideBeforeSignOut(() => hook)),
      {
        provide: DOCUMENT,
        useValue: {
          getElementById: document.getElementById.bind(document),
          cookie,
          location: { assign },
        },
      },
    ],
  });

  return {
    store: TestBed.inject(SessionStore),
    tokens,
    channel,
    intents,
    router,
    assign,
  };
}

function signedInResponse(): AuthSessionResponse {
  return {
    signedIn: true,
    claims: {
      sub: 'person-1',
      email: 'person@example.com',
      emailVerified: true,
      givenName: 'Given',
      familyName: 'Family',
      locale: 'el',
    },
  };
}

function requestSession(): Record<string, unknown> {
  return {
    at: 'access-token',
    exp: 1_800_000_000,
    sub: 'person-1',
    email: 'person@example.com',
    ev: true,
    gn: 'Given',
    fn: 'Family',
    loc: 'el',
  };
}
