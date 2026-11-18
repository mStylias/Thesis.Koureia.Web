import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideSynaxApi } from '@synax/client';
import { parseHttpError } from '@synax/client/core';
import type { Subscribable } from 'rxjs';

import {
  EmailVerificationApi,
  readAttemptsRemaining,
  readRetryAfterSeconds,
} from './email-verification.api';

const SEND_URL = 'https://api.test/api/v1/auth/email-verification/code';
const VERIFY_URL = 'https://api.test/api/v1/auth/email-verification/code/verify';

describe('EmailVerificationApi', () => {
  let api: EmailVerificationApi;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideSynaxApi({ baseUrl: 'https://api.test', defaultVersion: 1 }),
      ],
    });
    api = TestBed.inject(EmailVerificationApi);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    http.verify();
  });

  // The address comes off the token. A body that could carry one would be a way to aim a code
  // at somebody else's inbox.
  it('asks for a code with no body at all', () => {
    api.sendCode().subscribe();

    const request = http.expectOne(SEND_URL);
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toBeNull();
  });

  it('emits the lengths and times the screen renders from', async () => {
    const sent = firstEmission(api.sendCode());

    http.expectOne(SEND_URL).flush({
      sent: true,
      codeLength: 4,
      maxAttempts: 5,
      expiresAt: '2026-08-13T10:00:00Z',
      expiresInSeconds: 600,
      resendAvailableInSeconds: 60,
    });

    await expect(sent).resolves.toMatchObject({ codeLength: 4, resendAvailableInSeconds: 60 });
  });

  it('submits the code and nothing else', () => {
    api.submitCode('1234').subscribe();

    const request = http.expectOne(VERIFY_URL);
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual({ code: '1234' });
  });

  it('emits the outcome and the refresh instruction', async () => {
    const verified = firstEmission(api.submitCode('1234'));

    http
      .expectOne(VERIFY_URL)
      .flush({ outcome: 'Verified', attemptsRemaining: null, tokenRefreshRequired: true });

    await expect(verified).resolves.toEqual({
      outcome: 'Verified',
      attemptsRemaining: null,
      tokenRefreshRequired: true,
    });
  });
});

describe('verification problem extensions', () => {
  it('reads the cooldown off a resend refusal', () => {
    const error = parseHttpError(429, {
      title: 'EMAIL_VERIFICATION_RESEND_TOO_SOON',
      status: 429,
      retryAfterSeconds: 42,
    });

    expect(readRetryAfterSeconds(error)).toBe(42);
  });

  it('reads the attempts left off an incorrect code', () => {
    const error = parseHttpError(400, {
      title: 'EMAIL_VERIFICATION_CODE_INCORRECT',
      status: 400,
      attemptsRemaining: 2,
    });

    expect(readAttemptsRemaining(error)).toBe(2);
  });

  it.each([
    ['a failure with no extension', parseHttpError(400, { title: 'X', status: 400 })],
    ['a non-problem body', parseHttpError(500, '<html>gateway</html>')],
    ['something that is not an error at all', null],
  ])('answers null for %s', (_name, error) => {
    expect(readAttemptsRemaining(error)).toBeNull();
    expect(readRetryAfterSeconds(error)).toBeNull();
  });
});

function firstEmission<T>(source: Subscribable<T>): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    source.subscribe({ next: resolve, error: reject });
  });
}
