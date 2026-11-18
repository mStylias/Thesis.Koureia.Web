import { computed, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideTransloco, Translation, TranslocoLoader } from '@jsverse/transloco';
import { SessionClaims, SessionStatus, SessionStore, StaffAccessStore } from '@auth/data-access';
import { ActiveLanguage } from '@util/language';
import { Observable, of } from 'rxjs';

import { AuthEntry } from './auth-entry';

class SilentTranslocoLoader implements TranslocoLoader {
  getTranslation(): Observable<Translation> {
    return of({});
  }
}

const status = signal<SessionStatus>('deciding');
const claims = signal<SessionClaims | null>(null);
const signIn = vi.fn();
const signUp = vi.fn();
const signOut = vi.fn(() => Promise.resolve());
const canOpenWorkspace = signal(false);
const resolveAccess = vi.fn(() => Promise.resolve());

async function render(
  initial: SessionStatus,
  language: 'el' | 'en' = 'el',
  staff = false,
): Promise<ComponentFixture<AuthEntry>> {
  status.set(initial);
  canOpenWorkspace.set(staff);
  claims.set(
    initial === 'signed-in'
      ? {
          givenName: 'Given',
          familyName: 'Family',
          email: 'person@example.com',
          emailVerified: true,
        }
      : null,
  );
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    imports: [AuthEntry],
    providers: [
      provideRouter([]),
      provideTransloco({
        config: { availableLangs: ['el'], defaultLang: 'el' },
        loader: SilentTranslocoLoader,
      }),
      {
        provide: SessionStore,
        useValue: {
          status,
          isReady: computed(() => status() !== 'deciding'),
          isSignedIn: computed(() => status() === 'signed-in'),
          claims,
          isEmailVerified: computed(() => claims()?.emailVerified === true),
          signIn,
          signUp,
          signOut,
        },
      },
      { provide: StaffAccessStore, useValue: { canOpenWorkspace, resolve: resolveAccess } },
    ],
  });

  // Set before the component is created, exactly as `activateLanguage` does it on the
  // `:lang` route: the menu items read it while they are being built.
  TestBed.inject(ActiveLanguage).set(language);

  const fixture = TestBed.createComponent(AuthEntry);
  await fixture.whenStable();
  return fixture;
}

function buttons(fixture: ComponentFixture<AuthEntry>): HTMLButtonElement[] {
  return Array.from((fixture.nativeElement as HTMLElement).querySelectorAll('button'));
}

describe('AuthEntry', () => {
  beforeEach(() => {
    signIn.mockClear();
    signUp.mockClear();
    signOut.mockClear();
    resolveAccess.mockClear();
  });

  it('offers no actionable controls while the session is still being decided', async () => {
    const fixture = await render('deciding');
    const element = fixture.nativeElement as HTMLElement;

    expect(element.hasAttribute('data-deciding')).toBe(true);
    expect(buttons(fixture)).toHaveLength(1);
    expect(buttons(fixture)[0].disabled).toBe(true);
    expect(buttons(fixture)[0].getAttribute('aria-hidden')).toBe('true');
    expect(getComputedStyle(buttons(fixture)[0]).visibility).toBe('hidden');
  });

  it('lays out the final anonymous controls invisibly while deciding', async () => {
    const fixture = await render('deciding');
    fixture.componentRef.setInput('signUp', true);
    await fixture.whenStable();

    expect(buttons(fixture)).toHaveLength(2);
    expect(buttons(fixture).every((button) => button.disabled)).toBe(true);
  });

  it('offers sign in once the answer is nobody', async () => {
    const fixture = await render('signed-out');
    const [signInButton] = buttons(fixture);

    expect(buttons(fixture)).toHaveLength(1);
    expect(signInButton.disabled).toBe(false);

    signInButton.click();
    expect(signIn).toHaveBeenCalledTimes(1);
  });

  it('sends the current URL along, so a deep link survives the round trip', async () => {
    const fixture = await render('signed-out');
    const [signInButton] = buttons(fixture);

    signInButton.click();

    expect(signIn).toHaveBeenCalledWith('/');
  });

  it('offers signing up as well where the surface asks for it', async () => {
    const fixture = await render('signed-out');
    fixture.componentRef.setInput('signUp', true);
    await fixture.whenStable();
    const [signInButton, signUpButton] = buttons(fixture);

    expect(buttons(fixture)).toHaveLength(2);
    // The new account is the primary action there; signing in stays the quieter outline.
    expect(signInButton.getAttribute('data-variant')).toBe('outlined');
    expect(signUpButton.getAttribute('data-severity')).toBe('primary');
    expect(signUpButton.getAttribute('data-variant')).toBe('filled');

    signUpButton.click();
    expect(signUp).toHaveBeenCalledWith('/');
    expect(signIn).not.toHaveBeenCalled();
  });

  it('still offers sign in after a session expires', async () => {
    // `expired` differs from `signed-out` only in what the person is owed an explanation
    // for. The way back in is the same way in.
    const fixture = await render('expired');

    expect(buttons(fixture)).toHaveLength(1);
  });

  it('offers the account menu to somebody already signed in', async () => {
    const fixture = await render('signed-in');
    fixture.componentRef.setInput('size', 'sm');
    fixture.detectChanges();
    const [avatar] = buttons(fixture);

    expect(buttons(fixture)).toHaveLength(1);
    expect(avatar.getAttribute('data-variant')).toBe('text');
    expect(avatar.getAttribute('data-size')).toBe('md');
    expect(avatar.getAttribute('aria-haspopup')).toBe('menu');
    expect(avatar.querySelector('[lucidecircleuserround]')).not.toBeNull();
  });

  async function accountMenuHrefs(
    language: 'el' | 'en' = 'el',
    staff = false,
  ): Promise<(string | null)[]> {
    const fixture = await render('signed-in', language, staff);
    const [avatar] = buttons(fixture);

    avatar.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true }));
    avatar.click();
    await fixture.whenStable();

    return Array.from(document.querySelectorAll<HTMLAnchorElement>('a[role="menuitem"]')).map(
      (link) => link.getAttribute('href'),
    );
  }

  it('links to the account pages without defining them here', async () => {
    // Prefixed with the active language: `@ui/menu` receives these as data and hands them to
    // `routerLink`, so `[langLink]` never sees them and this component has to prefix them.
    expect(await accountMenuHrefs()).toEqual([
      '/el/account/appointments',
      '/el/account/reviews',
      '/el/account/profile',
    ]);
  });

  it('follows the active language rather than hardcoding the default', async () => {
    expect(await accountMenuHrefs('en')).toEqual([
      '/en/account/appointments',
      '/en/account/reviews',
      '/en/account/profile',
    ]);
  });

  it('reads the workspace once the address is verified', async () => {
    await render('signed-in');

    expect(resolveAccess).toHaveBeenCalled();
  });

  it('offers staff only the workspace, without a language prefix', async () => {
    expect(await accountMenuHrefs('en', true)).toEqual(['/management']);
  });

  it('signs out from the account menu', async () => {
    const fixture = await render('signed-in');
    const [avatar] = buttons(fixture);

    avatar.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true }));
    avatar.click();
    await fixture.whenStable();

    const items = Array.from(document.querySelectorAll<HTMLElement>('[role="menuitem"]'));
    items.at(-1)?.click();
    await fixture.whenStable();

    expect(signOut).toHaveBeenCalledOnce();
  });
});
