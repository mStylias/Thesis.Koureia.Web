import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { SessionStore } from '@auth/data-access';
import { provideSynaxApi } from '@synax/client';
import { ErrorHandler, computed, signal } from '@angular/core';
import { vi } from 'vitest';

import { LANGUAGE_COOKIE, UI_LANGUAGE_COOKIE } from '../../language-cookie';
import { LanguagePreferenceStore } from './language-preference.store';

const ME = 'https://api.test/api/v1/users/me';

describe('LanguagePreferenceStore', () => {
  let store: LanguagePreferenceStore;
  let http: HttpTestingController;
  const signedIn = signal(false);
  const handleError = vi.fn();
  const adoptLanguage = vi.fn(() => Promise.resolve());

  function configure(): void {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideSynaxApi({ baseUrl: 'https://api.test', defaultVersion: 1 }),
        {
          provide: SessionStore,
          useValue: { isSignedIn: computed(() => signedIn()), adoptLanguage },
        },
        { provide: ErrorHandler, useValue: { handleError } },
      ],
    });
    store = TestBed.inject(LanguagePreferenceStore);
    http = TestBed.inject(HttpTestingController);
  }

  function cookieValue(name: string = LANGUAGE_COOKIE): string | null {
    const match = new RegExp(`${name}=([^;]*)`).exec(document.cookie);
    return match?.[1] ?? null;
  }

  function clearCookies(): void {
    for (const name of [LANGUAGE_COOKIE, UI_LANGUAGE_COOKIE]) {
      document.cookie = `${name}=; Path=/; Max-Age=0`;
    }
  }

  beforeEach(() => {
    clearCookies();
    signedIn.set(false);
    handleError.mockClear();
    adoptLanguage.mockClear();
    adoptLanguage.mockImplementation(() => Promise.resolve());
    configure();
  });

  afterEach(() => {
    clearCookies();
  });

  describe('while anonymous', () => {
    it('remembers the choice in a cookie, so the next visit honours it', async () => {
      await store.persist('en');

      expect(cookieValue()).toBe('en');
    });

    it('mirrors the choice for the pages with no language in their address', async () => {
      await store.persist('en');

      expect(cookieValue(UI_LANGUAGE_COOKIE)).toBe('en');
    });

    it('asks the API for nothing — there is no account to write to', async () => {
      await store.persist('en');

      http.expectNone(ME);
    });
  });

  describe('while signed in', () => {
    beforeEach(() => {
      signedIn.set(true);
    });

    it('writes the preference to the profile', async () => {
      const done = store.persist('en');

      const request = http.expectOne(ME);
      expect(request.request.method).toBe('PATCH');
      expect(request.request.body).toEqual({ preferredLanguageCode: 'en' });

      request.flush({});
      await done;
    });

    it('does not also write the cookie — two answers to one question is one too many', async () => {
      const done = store.persist('en');
      http.expectOne(ME).flush({});
      await done;

      expect(cookieValue()).toBeNull();
    });

    // `/management` has no language in its address and reads this before the session answers.
    it('still mirrors the choice, or the workspace keeps the language just left', async () => {
      const done = store.persist('en');
      http.expectOne(ME).flush({});
      await done;

      expect(cookieValue(UI_LANGUAGE_COOKIE)).toBe('en');
    });

    it('resolves even when the write fails, so the switch is never blocked', async () => {
      const done = store.persist('en');
      http
        .expectOne(ME)
        .flush(
          { errorCode: 'USER_LANGUAGE_NOT_FOUND' },
          { status: 400, statusText: 'Bad Request' },
        );

      await expect(done).resolves.toBeUndefined();
    });

    it('reports a failed write, in production as well as development', async () => {
      const done = store.persist('en');
      http
        .expectOne(ME)
        .flush(
          { errorCode: 'USER_LANGUAGE_NOT_FOUND' },
          { status: 400, statusText: 'Bad Request' },
        );
      await done;

      expect(handleError).toHaveBeenCalledOnce();
      expect(handleError.mock.calls[0][0]).toBeInstanceOf(Error);
      expect((handleError.mock.calls[0][0] as Error).message).toContain('en');
    });

    it('reports a write that never reached the API — the fault that went unnoticed', async () => {
      const done = store.persist('el');
      http.expectOne(ME).error(new ProgressEvent('error'), { status: 0, statusText: '' });
      await done;

      expect(handleError).toHaveBeenCalledOnce();
    });

    it('says nothing when the write succeeds', async () => {
      const done = store.persist('en');
      http.expectOne(ME).flush({});
      await done;

      expect(handleError).not.toHaveBeenCalled();
    });

    // The claim the server reads before anything else. Without this the profile holds the new
    // language and the next visit to `/` still answers with the old one.
    it('moves the session claim once the profile has taken the write', async () => {
      const done = store.persist('en');
      http.expectOne(ME).flush({});
      await done;

      expect(adoptLanguage).toHaveBeenCalledWith('en');
    });

    it('leaves the claim alone when the profile refused, so it cannot claim a kept choice', async () => {
      const done = store.persist('en');
      http
        .expectOne(ME)
        .flush(
          { errorCode: 'USER_LANGUAGE_NOT_FOUND' },
          { status: 400, statusText: 'Bad Request' },
        );
      await done;

      expect(adoptLanguage).not.toHaveBeenCalled();
    });

    it('reports a claim that will not move, and still lets the switch through', async () => {
      adoptLanguage.mockRejectedValueOnce(new Error('session gone'));

      const done = store.persist('en');
      http.expectOne(ME).flush({});

      await expect(done).resolves.toBeUndefined();
      expect(handleError).toHaveBeenCalledOnce();
    });
  });
});
