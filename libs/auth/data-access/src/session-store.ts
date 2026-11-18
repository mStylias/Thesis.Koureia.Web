import { DOCUMENT, isPlatformBrowser } from '@angular/common';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import {
  DestroyRef,
  PLATFORM_ID,
  REQUEST_CONTEXT,
  Service,
  TransferState,
  computed,
  inject,
  isDevMode,
  makeStateKey,
  signal,
} from '@angular/core';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';
import { AppLanguage, languageFromPath, withLanguagePrefix } from '@util/language';
import { filter, firstValueFrom } from 'rxjs';

import { AccessTokenStore } from './access-token.store';
import { BEFORE_SIGN_OUT, BEFORE_SIGN_OUT_LIMIT_MS } from './before-sign-out';
import {
  AuthRequestSession,
  AuthSessionResponse,
  SessionClaims,
  readAuthRequestContext,
} from './auth-session.types';
import { PendingIntentStore } from './pending-intent.store';
import { SessionChannel } from './session-channel';
import { SessionStatus } from './session-status';

const SESSION_STATE_KEY = makeStateKey<AuthSessionResponse>('auth.session');
const SESSION_HINT_COOKIE = 'ks-hint';
/** Set in `sessionStorage` when this tab leaves for Keycloak to sign in or sign up. */
const FRESH_SIGN_IN_KEY = 'koureia.freshSignIn';

/** Owns the browser and server view of the current session. */
@Service()
export class SessionStore {
  private readonly http = inject(HttpClient);
  private readonly tokens = inject(AccessTokenStore);
  private readonly channel = inject(SessionChannel);
  private readonly intents = inject(PendingIntentStore);
  private readonly router = inject(Router);
  private readonly document = inject(DOCUMENT);
  private readonly transferState = inject(TransferState);
  private readonly requestContext = inject(REQUEST_CONTEXT);
  private readonly destroyRef = inject(DestroyRef);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private readonly beforeSignOut = inject(BEFORE_SIGN_OUT, { optional: true }) ?? [];

  private readonly state = signal<SessionStatus>('deciding');
  private readonly sessionClaims = signal<SessionClaims | null>(null);

  readonly status = this.state.asReadonly();
  readonly isReady = computed(() => this.state() !== 'deciding');
  readonly isSignedIn = computed(() => this.state() === 'signed-in');
  readonly claims = this.sessionClaims.asReadonly();
  readonly isEmailVerified = computed(() => this.sessionClaims()?.emailVerified === true);

  private readonly readyChanges = toObservable(this.isReady);

  /** Set on the first {@link whenReady}, so nothing subscribes until something waits. */
  private readyGate: Promise<void> | null = null;

  constructor() {
    if (!this.isBrowser) return;

    this.channel.listen(() => {
      this.endLocalSession('signed-out');
    });

    // Another tab replaced its claims. The message carries none of them, so ask the BFF.
    this.channel.listenChanged(() => {
      void this.resolveFromServer();
    });

    this.tokens.sessionExpired.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => {
      this.endLocalSession('expired');
    });
  }

  /**
   * Resolves once the session decision is in.
   *
   * {@link bootstrap} is started from `provideAppInitializer` and not awaited, so a guard on the
   * first navigation can reach `deciding` — where neither `isSignedIn` nor its negation is an
   * answer. Anything that branches on the session outside a template must wait here first.
   *
   * The status never returns to `deciding`, so the gate is resolved once and reused.
   */
  whenReady(): Promise<void> {
    if (this.isReady()) return Promise.resolve();

    this.readyGate ??= firstValueFrom(this.readyChanges.pipe(filter((ready) => ready))).then(
      () => undefined,
    );
    return this.readyGate;
  }

  /** Resolves the session from the server render or the BFF. */
  async bootstrap(): Promise<void> {
    if (!this.isBrowser) {
      const context = readAuthRequestContext(this.requestContext);
      if (context === null) return;

      const response = toSessionResponse(context.session);
      this.commit(response);
      this.transferState.set(SESSION_STATE_KEY, response);
      return;
    }

    if (this.transferState.hasKey(SESSION_STATE_KEY)) {
      const response = this.transferState.get(SESSION_STATE_KEY, signedOutResponse());
      this.transferState.remove(SESSION_STATE_KEY);
      this.commit(response);
      return;
    }

    if (hasSessionHint(this.document)) this.commit(hintedSignedInResponse());

    await this.resolveFromServer();
  }

  /**
   * Exchanges the token set now and adopts the claims it produced.
   *
   * Email verification is why this exists. Proving an address does not alter a token that is
   * already signed, so without this the session keeps saying `email_verified: false` until the
   * normal expiry window and every API call is refused in the meantime.
   *
   * Returns whether the session came back signed in.
   */
  async refresh(): Promise<boolean> {
    if (!this.isBrowser) return this.isSignedIn();

    let response: AuthSessionResponse;
    try {
      response = readSessionResponse(
        await firstValueFrom(this.http.post<unknown>('/auth/refresh', null)),
      );
    } catch (error) {
      // A refusal here is the provider declining to renew, which is the session ending.
      if (error instanceof HttpErrorResponse && error.status === 401) {
        this.endLocalSession('expired');
        return false;
      }
      if (isDevMode()) console.error('[auth] could not refresh the session', error);
      return this.isSignedIn();
    }

    // Both halves of one update: the claims are new, so the token cached against the old ones
    // must not be handed to the next request.
    this.tokens.invalidate();
    this.commit(response);
    this.channel.announceChanged();
    return response.signedIn;
  }

  /**
   * Records a language on the session, so the server's language decision follows a preference
   * that was just stored.
   *
   * The `locale` claim is sealed into the session cookie and the server reads it before anything
   * else when it has to choose a language. It follows the profile only at the next token refresh,
   * which is long enough for the visitor to be handed back the language they just left.
   *
   * Call it after the profile write succeeds, never instead of it: this moves a claim, not the
   * store of record.
   */
  async adoptLanguage(language: string): Promise<void> {
    if (!this.isBrowser) return;

    await firstValueFrom(this.http.post('/auth/language', { language }));

    // The in-memory claims are compared against the preference cookie by the language adoption
    // that runs on the next page load. Leaving them behind gives it a disagreement to act on.
    const claims = this.sessionClaims();
    if (claims !== null) this.sessionClaims.set({ ...claims, locale: language });
  }

  signIn(returnUrl?: string): void {
    this.startAuthorization('/auth/sign-in', returnUrl);
  }

  signUp(returnUrl?: string): void {
    this.startAuthorization('/auth/sign-up', returnUrl);
  }

  /** Runs the `BEFORE_SIGN_OUT` hooks, ends the session in all tabs, then follows the server response. */
  async signOut(): Promise<void> {
    if (!this.isBrowser) return;

    if (this.beforeSignOut.length > 0) await this.runBeforeSignOut();

    let redirectTo = '/';
    try {
      const response = await firstValueFrom(this.http.post<unknown>('/auth/sign-out', null));
      redirectTo = readRedirect(response) ?? redirectTo;
    } catch (error) {
      if (error instanceof HttpErrorResponse) {
        redirectTo = readRedirect(error.error) ?? redirectTo;
      }
      if (isDevMode()) console.error('[auth] sign-out did not finish cleanly', error);
    }

    this.channel.announceEnded();
    this.endLocalSession('signed-out');
    // A document load, not a Router navigation. The Router would instead match the empty
    // placeholder route at `/` and render nothing.
    this.document.location.assign(keepLanguage(redirectTo, languageFromPath(this.router.url)));
  }

  /**
   * Whether this tab came back from a sign-in or sign-up that it started. Answers `true` once,
   * because the call clears the mark. A cancelled sign-in leaves the mark too, so read
   * {@link isSignedIn} as well.
   */
  consumeFreshSignIn(): boolean {
    if (!this.isBrowser) return false;

    try {
      const fresh = sessionStorage.getItem(FRESH_SIGN_IN_KEY) !== null;
      sessionStorage.removeItem(FRESH_SIGN_IN_KEY);
      return fresh;
    } catch {
      return false;
    }
  }

  dismissExpired(): void {
    if (this.state() === 'expired') this.state.set('signed-out');
  }

  /** Waits for every hook or for the limit, whichever comes first. A failed hook counts as done. */
  private async runBeforeSignOut(): Promise<void> {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const limit = new Promise<void>((resolve) => {
      timer = setTimeout(resolve, BEFORE_SIGN_OUT_LIMIT_MS);
    });
    const hooks = Promise.allSettled(
      this.beforeSignOut.map((hook) => Promise.resolve().then(hook)),
    );

    await Promise.race([hooks, limit]);
    clearTimeout(timer);
  }

  private async resolveFromServer(): Promise<void> {
    try {
      const response = await firstValueFrom(this.http.get<unknown>('/auth/session'));
      this.commit(readSessionResponse(response));
    } catch (error) {
      if (isDevMode()) console.error('[auth] could not resolve the session', error);
      this.commit(signedOutResponse());
    }
  }

  private startAuthorization(path: string, returnUrl?: string): void {
    if (!this.isBrowser) return;

    const target = returnUrl ?? this.router.url;
    const safeTarget = target.startsWith('/auth/') ? '/' : target;
    const query = new URLSearchParams({ returnUrl: safeTarget });
    try {
      sessionStorage.setItem(FRESH_SIGN_IN_KEY, '1');
    } catch {
      // Private-mode quota refusal. Sign-in then returns to the page it started from.
    }
    this.document.location.assign(`${path}?${query.toString()}`);
  }

  private commit(response: AuthSessionResponse): void {
    this.sessionClaims.set(response.claims);
    this.state.set(response.signedIn ? 'signed-in' : 'signed-out');
  }

  private endLocalSession(status: Extract<SessionStatus, 'expired' | 'signed-out'>): void {
    this.tokens.clear();
    this.intents.clear();
    this.sessionClaims.set(null);
    this.state.set(status);
  }
}

function toSessionResponse(session: AuthRequestSession | null): AuthSessionResponse {
  if (session === null) return signedOutResponse();

  return {
    signedIn: true,
    claims: {
      sub: session.sub,
      email: session.email,
      emailVerified: session.ev,
      givenName: session.gn,
      familyName: session.fn,
      locale: session.loc,
    },
  };
}

function readSessionResponse(value: unknown): AuthSessionResponse {
  if (typeof value !== 'object' || value === null) throw new TypeError('Invalid session response.');

  const response = value as Record<string, unknown>;
  if (response['signedIn'] === false && response['claims'] === null) {
    return signedOutResponse();
  }
  if (response['signedIn'] !== true) throw new TypeError('Invalid session response.');

  return { signedIn: true, claims: readClaims(response['claims']) };
}

function readClaims(value: unknown): SessionClaims {
  if (typeof value !== 'object' || value === null) throw new TypeError('Invalid session claims.');

  const claims = value as Record<string, unknown>;
  return {
    sub: optionalString(claims['sub']),
    email: optionalString(claims['email']),
    emailVerified: claims['emailVerified'] === true,
    givenName: optionalString(claims['givenName']),
    familyName: optionalString(claims['familyName']),
    locale: optionalString(claims['locale']),
  };
}

function optionalString(value: unknown): string | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== 'string') throw new TypeError('Invalid session claim.');
  return value;
}

function readRedirect(value: unknown): string | null {
  if (typeof value !== 'object' || value === null) return null;
  const redirectTo = (value as Record<string, unknown>)['redirectTo'];
  return typeof redirectTo === 'string' &&
    redirectTo.startsWith('/') &&
    !redirectTo.startsWith('//')
    ? redirectTo
    : null;
}

/**
 * Keeps the page in the language it was signed out from.
 *
 * Sign-out clears the language cookie, and the site is Greek for anybody who has not chosen, so
 * the bare landing path would answer Greek — a person on an English account watches the site
 * turn at the moment they leave it. Prefixing here re-states the language they were reading,
 * and every later address is built from the path.
 *
 * The current path and not the `locale` claim: the claim is sealed into the session cookie and
 * lags a language switch made during the session.
 *
 * A server redirect that already names a language is left alone. It knows something this does
 * not.
 */
function keepLanguage(redirectTo: string, language: AppLanguage | null): string {
  if (language === null || languageFromPath(redirectTo) !== null) return redirectTo;
  return withLanguagePrefix(redirectTo, language);
}

function signedOutResponse(): AuthSessionResponse {
  return { signedIn: false, claims: null };
}

function hintedSignedInResponse(): AuthSessionResponse {
  return { signedIn: true, claims: null };
}

function hasSessionHint(document: Document): boolean {
  return document.cookie.split(';').some((part) => part.trim() === `${SESSION_HINT_COOKIE}=1`);
}
