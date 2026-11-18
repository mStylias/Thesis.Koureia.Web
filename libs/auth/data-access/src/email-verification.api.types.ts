/** What happened when a code was asked for. */
export interface VerificationCodeSendResponse {
  readonly sent: boolean;
  /** Render exactly this many cells. Never assume four. */
  readonly codeLength: number;
  readonly maxAttempts: number;
  /** Absolute expiry, ISO 8601. Null when nothing was sent. */
  readonly expiresAt: string | null;
  /** The same fact as a duration, for a browser clock that disagrees with the server's. */
  readonly expiresInSeconds: number | null;
  readonly resendAvailableInSeconds: number;
}

export type EmailVerificationOutcome =
  | 'Verified'
  | 'CodeIncorrect'
  | 'AttemptsExhausted'
  | 'NoCodePending';

/** What happened when a code was submitted. */
export interface EmailVerificationResponse {
  readonly outcome: EmailVerificationOutcome;
  readonly attemptsRemaining: number | null;
  /**
   * True on success, and stated rather than implied. Proving the address does not alter a token
   * already signed, so the caller's current one still says `email_verified: false` and every
   * other endpoint refuses it. Ignoring this shows a verified person a wall of refusals.
   */
  readonly tokenRefreshRequired: boolean;
}

/** The body of `POST auth/email-verification/code/verify`. */
export interface SubmitEmailVerificationCodeRequest {
  readonly code: string;
}
