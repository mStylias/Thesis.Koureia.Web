import { Component, DestroyRef, afterNextRender, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { TranslocoPipe, provideTranslocoScope } from '@jsverse/transloco';
import { firstValueFrom } from 'rxjs';
import {
  EmailVerificationApi,
  EmailVerificationErrors,
  PendingActionStore,
  SessionStore,
  VerificationCodeSendResponse,
  readAttemptsRemaining,
  readRetryAfterSeconds,
} from '@auth/data-access';
import { HttpError } from '@synax/client/core';
import { Button } from '@ui/button';
import { InputOtp } from '@ui/input-otp';
import { ActiveLanguage } from '@util/language';

import { safeReturnUrl } from './return-url';
import { verifyEmailTranslocoScope } from './verify-email.i18n';

/** Until the first response says otherwise. The API is the authority on both. */
const FALLBACK_CODE_LENGTH = 6;
const TICK_MS = 1000;

/** The message under the field. One per next action, which is why it is not a boolean. */
type VerifyEmailNotice =
  | 'codeIncorrect'
  | 'attemptsExhausted'
  | 'noCodePending'
  | 'emailMissing'
  | 'dailyLimitReached'
  | 'sendFailed'
  | 'verifyFailed'
  | null;

/**
 * Proving the address a local registration signed up with.
 *
 * Reached from the BFF callback, which sends every session whose `email_verified` is false here
 * rather than to a page the API will only refuse. Google identities arrive verified and never
 * see it.
 *
 * The screen asks for a code on entry and submits as soon as the last cell is filled. On success
 * it forces a session refresh **before** leaving: proving the address cannot alter a token that
 * is already signed, so navigating first would land on the same wall of 403s the person just
 * escaped.
 *
 * Cell count, attempt count and both countdowns come from the API. Nothing here hardcodes four
 * digits or ten minutes, so a backend configuration change needs no release.
 */
@Component({
  selector: 'auth-verify-email',
  imports: [Button, InputOtp, TranslocoPipe],
  providers: [provideTranslocoScope(verifyEmailTranslocoScope)],
  templateUrl: './verify-email.html',
  styleUrl: './verify-email.scss',
})
export class VerifyEmail {
  private readonly api = inject(EmailVerificationApi);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly language = inject(ActiveLanguage);

  protected readonly session = inject(SessionStore);

  /**
   * What the person was in the middle of. Read, not consumed: the flow that wrote it clears it
   * when it resumes, and a failed verification must not lose the reassurance.
   *
   * This screen renders labelled rows and knows nothing about the flow that filled them.
   */
  protected readonly pendingAction = inject(PendingActionStore).peek();

  protected readonly code = signal('');
  protected readonly codeLength = signal(FALLBACK_CODE_LENGTH);
  protected readonly attemptsRemaining = signal<number | null>(null);
  protected readonly notice = signal<VerifyEmailNotice>(null);
  protected readonly sending = signal(false);
  protected readonly verifying = signal(false);

  /** Drives both countdowns off one clock rather than two intervals that drift apart. */
  private readonly now = signal(0);
  private readonly resendAt = signal<number | null>(null);
  private readonly expiresAt = signal<number | null>(null);

  protected readonly email = computed(() => this.session.claims()?.email ?? '');

  protected readonly resendInSeconds = computed(() => secondsUntil(this.resendAt(), this.now()));
  protected readonly expiresInSeconds = computed(() => secondsUntil(this.expiresAt(), this.now()));

  /** `m:ss`. Ten minutes as `600 seconds` is a number nobody reads as a duration. */
  protected readonly expiresInLabel = computed(() => {
    const total = this.expiresInSeconds();
    return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
  });
  protected readonly canResend = computed(() => !this.sending() && this.resendInSeconds() === 0);

  /** Exhausted attempts destroy the code at the API, so only a resend can help. */
  protected readonly locked = computed(() => this.notice() === 'attemptsExhausted');

  protected readonly canSubmit = computed(
    () => !this.locked() && !this.verifying() && this.code().length === this.codeLength(),
  );

  protected readonly invalid = computed(
    () => this.notice() === 'codeIncorrect' || this.notice() === 'attemptsExhausted',
  );

  constructor() {
    const destroyRef = inject(DestroyRef);

    // Browser only, and once. On the server there is no code to ask for and no clock to run,
    // and a send from the render would issue a code nobody asked for on every crawl.
    afterNextRender(() => {
      const timer = setInterval(() => {
        this.now.set(Date.now());
      }, TICK_MS);
      destroyRef.onDestroy(() => {
        clearInterval(timer);
      });
      this.now.set(Date.now());
      void this.start();
    });
  }

  protected async submit(): Promise<void> {
    if (!this.canSubmit()) return;

    this.verifying.set(true);
    try {
      const result = await firstValueFrom(this.api.submitCode(this.code()));
      if (result.outcome === 'Verified') {
        await this.leaveVerified();
        return;
      }
      // Every non-verified outcome also arrives as a problem response, so this is the
      // belt-and-braces branch for a body the endpoint is not expected to send.
      this.notice.set('verifyFailed');
    } catch (error) {
      await this.onSubmitFailed(error);
    } finally {
      this.verifying.set(false);
    }
  }

  /** The resend action. Also the first send, through {@link start}. */
  protected async resend(): Promise<void> {
    if (!this.canResend()) return;
    await this.send();
  }

  private async start(): Promise<void> {
    // Arriving already verified — a second tab finished, or the person came back to the URL.
    if (this.session.isEmailVerified()) {
      await this.leave();
      return;
    }
    await this.send();
  }

  private async send(): Promise<void> {
    this.sending.set(true);
    try {
      this.adopt(await firstValueFrom(this.api.sendCode()));
      // A new code makes every message about the old one wrong.
      this.notice.set(null);
      this.attemptsRemaining.set(null);
      this.code.set('');
    } catch (error) {
      await this.onSendFailed(error);
    } finally {
      this.sending.set(false);
    }
  }

  private async onSendFailed(error: unknown): Promise<void> {
    switch (errorCode(error)) {
      case EmailVerificationErrors.resendTooSoon:
        // Not a failure. The code already in the person's inbox is still the right one, so keep
        // the field usable and only count down.
        this.startResendCooldown(readRetryAfterSeconds(error));
        break;
      case EmailVerificationErrors.alreadyVerified:
        await this.leaveVerified();
        break;
      case EmailVerificationErrors.emailMissing:
        this.notice.set('emailMissing');
        break;
      // No countdown: the wait is hours, and the code already sent may still be valid.
      case EmailVerificationErrors.dailyLimitReached:
        this.notice.set('dailyLimitReached');
        break;
      default:
        this.notice.set('sendFailed');
    }
  }

  private async onSubmitFailed(error: unknown): Promise<void> {
    switch (errorCode(error)) {
      case EmailVerificationErrors.codeIncorrect:
        this.attemptsRemaining.set(readAttemptsRemaining(error));
        this.notice.set('codeIncorrect');
        break;
      case EmailVerificationErrors.attemptsExhausted:
        this.attemptsRemaining.set(0);
        this.notice.set('attemptsExhausted');
        break;
      case EmailVerificationErrors.noCodePending:
        if (await this.leaveIfVerified()) return;
        this.expiresAt.set(null);
        this.notice.set('noCodePending');
        break;
      case EmailVerificationErrors.alreadyVerified:
        await this.leaveVerified();
        break;
      default:
        if (await this.leaveIfVerified()) return;
        this.notice.set('verifyFailed');
    }
  }

  /**
   * Asks the provider again before a failure is shown. A submit whose answer was lost on the way
   * back still verified the address and spent the code, so the retry gets "no code pending".
   */
  private async leaveIfVerified(): Promise<boolean> {
    await this.session.refresh();
    if (!this.session.isEmailVerified()) return false;

    await this.leave();
    return true;
  }

  private adopt(response: VerificationCodeSendResponse): void {
    if (response.codeLength > 0) this.codeLength.set(response.codeLength);
    this.startResendCooldown(response.resendAvailableInSeconds);
    this.expiresAt.set(deadline(response.expiresInSeconds, response.expiresAt));
  }

  private startResendCooldown(seconds: number | null): void {
    this.resendAt.set(deadline(seconds, null));
    // Read the clock again, or the first frame renders against whatever the last tick said and
    // shows a second more than the API granted.
    this.now.set(Date.now());
  }

  /**
   * Replaces the token set, then leaves. Both, in this order: the API refuses the old token
   * whatever Keycloak now says about the address.
   */
  private async leaveVerified(): Promise<void> {
    await this.session.refresh();
    await this.leave();
  }

  private async leave(): Promise<void> {
    // The pending intent is deliberately left alone. Verification is not the operation that
    // recorded it, and only the flow that owns it may consume it.
    const target = safeReturnUrl(
      this.route.snapshot.queryParamMap.get('returnUrl'),
      this.language.value(),
    );
    await this.router.navigateByUrl(target);
  }
}

/** Whole seconds left, never negative. Zero means the deadline passed or was never set. */
function secondsUntil(deadlineMs: number | null, now: number): number {
  if (deadlineMs === null) return 0;
  return Math.max(0, Math.ceil((deadlineMs - now) / 1000));
}

/**
 * Anchors a countdown to this browser's clock.
 *
 * The duration wins over the absolute timestamp. Both describe the same moment, but a browser
 * clock minutes out of step with the server turns the absolute one into a lie, and the duration
 * does not care what time either machine thinks it is.
 */
function deadline(seconds: number | null, absolute: string | null): number | null {
  if (seconds !== null && Number.isFinite(seconds)) return Date.now() + Math.max(0, seconds) * 1000;
  if (absolute === null) return null;

  const parsed = Date.parse(absolute);
  return Number.isNaN(parsed) ? null : parsed;
}

function errorCode(error: unknown): string | undefined {
  return (error as Partial<HttpError> | null | undefined)?.errorCode;
}
