import { HttpClient } from '@angular/common/http';
import { Service, inject } from '@angular/core';
import { HttpError } from '@synax/client/core';
import { injectSynaxUrl } from '@synax/client';
import { Observable } from 'rxjs';

import type {
  EmailVerificationResponse,
  SubmitEmailVerificationCodeRequest,
  VerificationCodeSendResponse,
} from './email-verification.api.types';

/** Refused because the address is unproven. Route to verification, not to a permission message. */
export const AUTH_EMAIL_NOT_VERIFIED = 'AUTH_EMAIL_NOT_VERIFIED';

/**
 * The verification error codes. One per next action, which is why a screen switches on these and
 * not on the status: `400` alone cannot say whether to retype, to ask for a new code, or to stop.
 */
export const EmailVerificationErrors = {
  /** Nothing to do. Refresh the session and carry on. */
  alreadyVerified: 'EMAIL_VERIFICATION_ALREADY_VERIFIED',
  /** None sent, or the last one expired or was burned. Offer a new one. */
  noCodePending: 'EMAIL_VERIFICATION_NO_CODE_PENDING',
  /** Wrong, attempts remain. {@link readAttemptsRemaining} says how many. */
  codeIncorrect: 'EMAIL_VERIFICATION_CODE_INCORRECT',
  /** The cap was reached and the code destroyed. Only a resend helps. */
  attemptsExhausted: 'EMAIL_VERIFICATION_ATTEMPTS_EXHAUSTED',
  /** Inside the cooldown. {@link readRetryAfterSeconds} says how long. */
  resendTooSoon: 'EMAIL_VERIFICATION_RESEND_TOO_SOON',
  /** The day's codes are used up. A resend only helps once the day has passed. */
  dailyLimitReached: 'EMAIL_VERIFICATION_DAILY_LIMIT_REACHED',
  /** No `email` claim on the account. A realm misconfiguration, so retrying cannot fix it. */
  emailMissing: 'EMAIL_VERIFICATION_EMAIL_MISSING',
  /** Nothing was decided, so a retry is meaningful. */
  failed: 'EMAIL_VERIFICATION_FAILED',
} as const;

/**
 * Proving the caller's own email address with a numeric code.
 *
 * Neither call takes an address. Both read it from the access token, which is what makes it
 * impossible to aim a code at somebody else's inbox — so never add one to either signature.
 *
 * These are the only two API endpoints an unverified caller can reach. Everything else answers
 * `403 AUTH_EMAIL_NOT_VERIFIED` until this succeeds.
 */
@Service()
export class EmailVerificationApi {
  private readonly http = inject(HttpClient);
  private readonly url = injectSynaxUrl();

  /** Sends, or resends, a code. Inside the cooldown this fails with `resendTooSoon`. */
  sendCode(): Observable<VerificationCodeSendResponse> {
    return this.http.post<VerificationCodeSendResponse>(
      this.url('auth/email-verification/code'),
      null,
    );
  }

  submitCode(code: string): Observable<EmailVerificationResponse> {
    const body: SubmitEmailVerificationCodeRequest = { code };
    return this.http.post<EmailVerificationResponse>(
      this.url('auth/email-verification/code/verify'),
      body,
    );
  }
}

/** Seconds left on the resend cooldown, from a `resendTooSoon` failure. */
export function readRetryAfterSeconds(error: unknown): number | null {
  return readProblemNumber(error, 'retryAfterSeconds');
}

/** Attempts left on the current code, from a `codeIncorrect` failure. */
export function readAttemptsRemaining(error: unknown): number | null {
  return readProblemNumber(error, 'attemptsRemaining');
}

/**
 * A Problem Details extension member. The parsed error keeps the whole body on `raw`, so the
 * numbers the API attaches to a refusal are read here once instead of in every screen.
 */
function readProblemNumber(error: unknown, member: string): number | null {
  const raw = (error as Partial<HttpError> | null | undefined)?.raw;
  if (typeof raw !== 'object' || raw === null) return null;

  const value = (raw as Record<string, unknown>)[member];
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}
