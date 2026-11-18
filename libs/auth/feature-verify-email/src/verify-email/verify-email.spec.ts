import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router, convertToParamMap } from '@angular/router';
import { Translation, TranslocoLoader, provideTransloco } from '@jsverse/transloco';
import { EmailVerificationApi, SessionStore } from '@auth/data-access';
import { ActiveLanguage } from '@util/language';
import { Observable, of, throwError } from 'rxjs';

import el from './i18n/el';
import { VerifyEmail } from './verify-email';

/**
 * The real Greek dictionary, flattened under the scope prefix the component provides. The
 * assertions read rendered copy, so an empty loader would make every one of them pass on a blank
 * page.
 */
class ScopedTranslocoLoader implements TranslocoLoader {
  getTranslation(): Observable<Translation> {
    return of(prefix(el, 'verifyEmail'));
  }
}

function prefix(translation: Translation, scope: string): Translation {
  const flat: Translation = {};
  const visit = (value: Record<string, unknown>, path: string): void => {
    for (const [key, entry] of Object.entries(value)) {
      const next = `${path}.${key}`;
      if (typeof entry === 'object' && entry !== null)
        visit(entry as Record<string, unknown>, next);
      else flat[next] = entry as string;
    }
  };
  visit(translation, scope);
  return flat;
}

/** The shape the API sends when a code goes out. Ten minutes, sixty-second cooldown. */
function sendResponse(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    sent: true,
    codeLength: 4,
    maxAttempts: 5,
    expiresAt: '2026-08-13T10:10:00Z',
    expiresInSeconds: 600,
    resendAvailableInSeconds: 60,
    ...overrides,
  };
}

/** An `ApiError` as the screen sees it: a code and the problem body it came with. */
function apiError(errorCode: string, raw: Record<string, unknown> = {}): unknown {
  return { errorCode, httpCode: 400, raw: { title: errorCode, ...raw } };
}

interface Harness {
  readonly fixture: ComponentFixture<VerifyEmail>;
  readonly api: { sendCode: ReturnType<typeof vi.fn>; submitCode: ReturnType<typeof vi.fn> };
  readonly session: {
    refresh: ReturnType<typeof vi.fn<() => Promise<boolean>>>;
    isEmailVerified: ReturnType<typeof signal<boolean>>;
    claims: ReturnType<typeof signal<{ email: string } | null>>;
  };
  readonly navigateByUrl: ReturnType<typeof vi.fn>;
  /** The rendered live region, which is where every API result ends up. */
  status(): string;
  code(value: string): void;
}

async function render(options?: {
  send?: unknown;
  verified?: boolean;
  returnUrl?: string | null;
}): Promise<Harness> {
  const api = {
    sendCode: vi.fn(() => resultOf(options?.send ?? sendResponse())),
    submitCode: vi.fn(() =>
      of({ outcome: 'Verified', attemptsRemaining: null, tokenRefreshRequired: true }),
    ),
  };
  const session = {
    refresh: vi.fn(() => Promise.resolve(true)),
    isEmailVerified: signal(options?.verified ?? false),
    claims: signal<{ email: string } | null>({ email: 'person@example.com' }),
  };
  const navigateByUrl = vi.fn(() => Promise.resolve(true));

  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    imports: [VerifyEmail],
    providers: [
      provideTransloco({
        config: { availableLangs: ['el'], defaultLang: 'el' },
        loader: ScopedTranslocoLoader,
      }),
      { provide: EmailVerificationApi, useValue: api },
      { provide: SessionStore, useValue: session },
      { provide: Router, useValue: { navigateByUrl } },
      {
        provide: ActivatedRoute,
        useValue: {
          snapshot: {
            queryParamMap: convertToParamMap(
              options?.returnUrl === null || options?.returnUrl === undefined
                ? {}
                : { returnUrl: options.returnUrl },
            ),
          },
        },
      },
    ],
  });
  TestBed.inject(ActiveLanguage).set('el');

  const fixture = TestBed.createComponent(VerifyEmail);
  await settle(fixture);

  return {
    fixture,
    api,
    session,
    navigateByUrl,
    status: () => query(fixture, '#verify-email-status')?.textContent.trim() ?? '',
    code: (value: string) => {
      const input = codeField(fixture);
      input.value = value;
      input.dispatchEvent(new Event('input'));
      fixture.detectChanges();
    },
  };
}

/**
 * When the first call to a mock happened, relative to every other mock in this test. Answers
 * `Infinity` for a mock that was never called, so an ordering assertion fails rather than throws.
 */
function callOrder(mock: ReturnType<typeof vi.fn>): number {
  return mock.mock.invocationCallOrder.at(0) ?? Number.POSITIVE_INFINITY;
}

function query(fixture: ComponentFixture<VerifyEmail>, selector: string): Element | null {
  return (fixture.nativeElement as HTMLElement).querySelector(selector);
}

function codeField(fixture: ComponentFixture<VerifyEmail>): HTMLInputElement {
  const input = query(fixture, 'input');
  if (!(input instanceof HTMLInputElement)) throw new Error('The code field was not rendered.');
  return input;
}

/**
 * Runs the component's promise chains to the end.
 *
 * `whenStable()` alone is not enough: send-then-adopt and verify-then-refresh-then-navigate are
 * each several microtasks deep, and a single await lands in the middle of one.
 */
async function settle(fixture: ComponentFixture<VerifyEmail>): Promise<void> {
  for (let pass = 0; pass < 4; pass++) {
    await fixture.whenStable();
    // A macrotask, not just a microtask: the Transloco scope load resolves on one, and every
    // assertion here reads rendered copy.
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
  fixture.detectChanges();
}

function resultOf(value: unknown): Observable<never> | Observable<unknown> {
  return isThrown(value) ? throwError(() => value.thrown) : of(value);
}

function isThrown(value: unknown): value is { thrown: unknown } {
  return typeof value === 'object' && value !== null && 'thrown' in value;
}

describe('VerifyEmail', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('asks for a code on entry, with no address in the request', async () => {
    const harness = await render();

    expect(harness.api.sendCode).toHaveBeenCalledOnce();
    expect(harness.api.sendCode).toHaveBeenCalledWith();
  });

  it('renders the number of cells the API asked for, not four', async () => {
    const harness = await render({ send: sendResponse({ codeLength: 6 }) });

    const cells = (harness.fixture.nativeElement as HTMLElement).querySelectorAll('.otp-cell');
    expect(cells).toHaveLength(6);
  });

  it('leaves without asking for a code when the address is already proven', async () => {
    const harness = await render({ verified: true, returnUrl: '/el/barbershops' });

    expect(harness.api.sendCode).not.toHaveBeenCalled();
    expect(harness.navigateByUrl).toHaveBeenCalledWith('/el/barbershops');
  });

  it('submits as soon as the last cell is filled', async () => {
    const harness = await render();

    harness.code('1234');
    await settle(harness.fixture);

    expect(harness.api.submitCode).toHaveBeenCalledWith('1234');
  });

  // The whole reason this screen exists in this order. Navigating first would land the person
  // back on the 403s they came here to escape.
  it('refreshes the session before it navigates away', async () => {
    const harness = await render({ returnUrl: '/el/barbershops?near=me' });

    harness.code('1234');
    await settle(harness.fixture);

    expect(harness.session.refresh).toHaveBeenCalledOnce();
    expect(harness.navigateByUrl).toHaveBeenCalledWith('/el/barbershops?near=me');
    expect(callOrder(harness.session.refresh)).toBeLessThan(callOrder(harness.navigateByUrl));
  });

  it('refuses a return URL that points off this origin', async () => {
    const harness = await render({ returnUrl: '//attacker.example' });

    harness.code('1234');
    await settle(harness.fixture);

    expect(harness.navigateByUrl).toHaveBeenCalledWith('/el');
  });

  it('keeps the field usable and counts down when a resend is too soon', async () => {
    const harness = await render({
      send: {
        thrown: apiError('EMAIL_VERIFICATION_RESEND_TOO_SOON', { retryAfterSeconds: 42 }),
      },
    });

    // Not an error state: the code already in the inbox is still the right one.
    expect(codeField(harness.fixture).disabled).toBe(false);
    expect((harness.fixture.nativeElement as HTMLElement).textContent).toContain('42');
  });

  it('shows how many tries are left on an incorrect code', async () => {
    const harness = await render();
    harness.api.submitCode.mockReturnValueOnce(
      throwError(() => apiError('EMAIL_VERIFICATION_CODE_INCORRECT', { attemptsRemaining: 2 })),
    );

    harness.code('1234');
    await settle(harness.fixture);

    expect(harness.status()).toContain('2');
    expect(harness.navigateByUrl).not.toHaveBeenCalled();
  });

  it('stops accepting a code once the attempts are exhausted', async () => {
    const harness = await render();
    harness.api.submitCode.mockReturnValueOnce(
      throwError(() => apiError('EMAIL_VERIFICATION_ATTEMPTS_EXHAUSTED')),
    );

    harness.code('1234');
    await settle(harness.fixture);

    expect(codeField(harness.fixture).disabled).toBe(true);
  });

  it('says the codes for today are used up, with no countdown of hours', async () => {
    const harness = await render({
      send: {
        thrown: apiError('EMAIL_VERIFICATION_DAILY_LIMIT_REACHED', { retryAfterSeconds: 80000 }),
      },
    });

    expect(harness.status()).not.toBe('');
    expect((harness.fixture.nativeElement as HTMLElement).textContent).not.toContain('80000');
  });

  it('refreshes and leaves when the address turns out to be verified already', async () => {
    const harness = await render({
      send: { thrown: apiError('EMAIL_VERIFICATION_ALREADY_VERIFIED') },
      returnUrl: '/el/barbershops',
    });

    expect(harness.session.refresh).toHaveBeenCalledOnce();
    expect(harness.navigateByUrl).toHaveBeenCalledWith('/el/barbershops');
  });

  // The first submit verified the address but its answer never arrived, so the retry finds the
  // code spent. The session knows the truth.
  it('leaves when a spent code belongs to a submit that already verified', async () => {
    const harness = await render({ returnUrl: '/el/barbershops' });
    harness.session.refresh.mockImplementationOnce(() => {
      harness.session.isEmailVerified.set(true);
      return Promise.resolve(true);
    });
    harness.api.submitCode.mockReturnValueOnce(
      throwError(() => apiError('EMAIL_VERIFICATION_NO_CODE_PENDING')),
    );

    harness.code('1234');
    await settle(harness.fixture);

    expect(harness.navigateByUrl).toHaveBeenCalledWith('/el/barbershops');
  });

  it('leaves when the answer to a submit is lost but the address is verified', async () => {
    const harness = await render({ returnUrl: '/el/barbershops' });
    harness.session.refresh.mockImplementationOnce(() => {
      harness.session.isEmailVerified.set(true);
      return Promise.resolve(true);
    });
    harness.api.submitCode.mockReturnValueOnce(throwError(() => ({ httpCode: 0, raw: null })));

    harness.code('1234');
    await settle(harness.fixture);

    expect(harness.navigateByUrl).toHaveBeenCalledWith('/el/barbershops');
  });

  it('asks for a new code when the code is spent and the address is still unproven', async () => {
    const harness = await render();
    harness.api.submitCode.mockReturnValueOnce(
      throwError(() => apiError('EMAIL_VERIFICATION_NO_CODE_PENDING')),
    );

    harness.code('1234');
    await settle(harness.fixture);

    expect(harness.session.refresh).toHaveBeenCalledOnce();
    expect(harness.status()).toContain('Ζήτησε νέο');
    expect(harness.navigateByUrl).not.toHaveBeenCalled();
  });

  it('reports an account with no address as unfixable by retrying', async () => {
    const harness = await render({
      send: { thrown: apiError('EMAIL_VERIFICATION_EMAIL_MISSING') },
    });

    expect(harness.status()).not.toBe('');
    expect(harness.navigateByUrl).not.toHaveBeenCalled();
  });

  it('clears the previous message and code when a new one is sent', async () => {
    const harness = await render();
    harness.api.submitCode.mockReturnValueOnce(
      throwError(() => apiError('EMAIL_VERIFICATION_CODE_INCORRECT', { attemptsRemaining: 1 })),
    );
    harness.code('1234');
    await settle(harness.fixture);
    expect(harness.status()).not.toBe('');

    harness.api.sendCode.mockReturnValueOnce(of(sendResponse({ resendAvailableInSeconds: 0 })));
    await resendThroughComponent(harness);

    expect(codeField(harness.fixture).value).toBe('');
  });
});

/**
 * Resend is behind a sixty-second cooldown that the first send starts, so a test that wants the
 * second send has to move past it rather than click through the disabled button.
 */
async function resendThroughComponent(harness: Harness): Promise<void> {
  const component = harness.fixture.componentInstance as unknown as {
    resendAt: ReturnType<typeof signal<number | null>>;
    resend: () => Promise<void>;
  };
  component.resendAt.set(null);
  await component.resend();
  harness.fixture.detectChanges();
}
