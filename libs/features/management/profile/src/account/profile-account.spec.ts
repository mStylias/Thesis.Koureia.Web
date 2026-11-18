import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { provideTransloco, Translation, TranslocoLoader } from '@jsverse/transloco';
import { UserProfileApi, type UserResponse } from '@api/users';
import { SessionStore, type SessionClaims } from '@auth/data-access';
import { Result, type HttpError } from '@synax/client/core';
import { ConfirmationService } from '@ui/confirmation-dialog';
import { ToasterService } from '@ui/toaster';
import { Observable, of, throwError } from 'rxjs';
import { PageEditors, providePageSections } from '@features/management-shared-page-sections';

import { ProfileAccount } from './profile-account';

class EmptyLoader implements TranslocoLoader {
  getTranslation(): Observable<Translation> {
    return of({});
  }
}

@Component({ template: '' })
class Page {}

const USER: UserResponse = {
  id: 'u1',
  keycloakId: 'k1',
  firstName: 'Άρης',
  lastName: 'Δημάκης',
  email: 'aris.dimakis@koureia.local',
  phoneNumber: null,
  language: { id: 'l1', code: 'el', name: 'Ελληνικά' },
  emailRemindersEnabled: true,
};

const api = {
  current: vi.fn<() => Observable<UserResponse>>(),
  update: vi.fn<(patch: unknown) => Observable<Result<UserResponse>>>(),
};
const claims = signal<SessionClaims | null>(null);
const session = { claims, refresh: vi.fn(() => Promise.resolve(true)) };
const toaster = { success: vi.fn(), error: vi.fn() };
const confirmation = { open: vi.fn(() => Promise.resolve('confirmed')) };

describe('ProfileAccount', () => {
  let fixture: ComponentFixture<ProfileAccount>;

  async function render(url = '/management/profile', user: UserResponse = USER): Promise<void> {
    api.current.mockReturnValue(of(user));
    TestBed.configureTestingModule({
      providers: [
        provideRouter([{ path: '**', component: Page }]),
        provideTransloco({
          config: { availableLangs: ['el', 'en'], defaultLang: 'el' },
          loader: EmptyLoader,
        }),
        providePageSections({ discardMessage: 'managementProfile.discard.message' }),
        { provide: UserProfileApi, useValue: api },
        { provide: SessionStore, useValue: session },
        { provide: ToasterService, useValue: toaster },
        { provide: ConfirmationService, useValue: confirmation },
      ],
    });
    await TestBed.inject(Router).navigateByUrl(url);
    fixture = TestBed.createComponent(ProfileAccount);
    await settle();
  }

  async function settle(): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, 0));
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  function host(): HTMLElement {
    return fixture.nativeElement as HTMLElement;
  }

  function button(label: string): HTMLButtonElement {
    const found = Array.from(host().querySelectorAll('button')).find(
      (candidate) => candidate.textContent.trim() === label,
    );
    if (found === undefined) throw new Error(`${label} not rendered`);
    return found;
  }

  function input(autocomplete: string): HTMLInputElement {
    const found = host().querySelector<HTMLInputElement>(`input[autocomplete="${autocomplete}"]`);
    if (found === null) throw new Error(`${autocomplete} not rendered`);
    return found;
  }

  function type(field: HTMLInputElement, value: string): void {
    field.value = value;
    field.dispatchEvent(new Event('input'));
  }

  async function submit(): Promise<void> {
    const form = host().querySelector('form');
    if (form === null) throw new Error('form not rendered');
    form.dispatchEvent(new Event('submit', { cancelable: true }));
    await settle();
  }

  async function edit(): Promise<void> {
    button('managementProfile.actions.edit').click();
    await settle();
  }

  beforeEach(() => {
    vi.clearAllMocks();
    claims.set({ givenName: 'Άρης', familyName: 'Δημάκης', emailVerified: true });
  });

  it('shows the values in view mode and omits an empty phone', async () => {
    await render();

    expect(host().textContent).toContain('Άρης');
    expect(host().textContent).toContain('Δημάκης');
    expect(host().textContent).toContain('aris.dimakis@koureia.local');
    expect(host().textContent).not.toContain('managementProfile.profile.phone');
    expect(host().querySelector('input')).toBeNull();
  });

  it('shows a phone that is set in groups, as the Staff page does', async () => {
    await render('/management/profile', { ...USER, phoneNumber: '+306912345678' });

    expect(host().textContent).toContain('managementProfile.profile.phone');
    expect(host().textContent).toContain('+30 691 234 5678');
    expect(host().textContent).not.toContain('+306912345678');
  });

  it('links the name hint to both name inputs in edit mode', async () => {
    await render();

    await edit();

    const hint = host().querySelector('#profile-name-hint');
    expect(hint?.textContent).toContain('managementProfile.profile.nameHint');
    for (const name of [input('given-name'), input('family-name')]) {
      expect(name.getAttribute('aria-describedby')?.split(' ')).toContain('profile-name-hint');
    }
  });

  it('shows the failure with a retry when the profile does not load', async () => {
    api.current.mockReturnValue(throwError(() => new Error('down')));
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        provideTransloco({
          config: { availableLangs: ['el'], defaultLang: 'el' },
          loader: EmptyLoader,
        }),
        providePageSections({ discardMessage: 'managementProfile.discard.message' }),
        { provide: UserProfileApi, useValue: api },
        { provide: SessionStore, useValue: session },
        { provide: ToasterService, useValue: toaster },
      ],
    });
    fixture = TestBed.createComponent(ProfileAccount);
    await settle();

    expect(host().querySelector('[role="alert"]')?.textContent).toContain(
      'managementPageSections.section.failed',
    );

    api.current.mockReturnValue(of(USER));
    button('managementPageSections.section.retry').click();
    await settle();

    expect(host().textContent).toContain('Άρης');
  });

  it('sends only the changed fields, then returns to view', async () => {
    await render();
    api.update.mockReturnValue(of(Result.Ok({ ...USER, phoneNumber: null, lastName: 'Δημάκος' })));

    await edit();
    type(input('family-name'), ' Δημάκος ');
    await submit();

    expect(api.update).toHaveBeenCalledWith({ lastName: 'Δημάκος' });
    expect(toaster.success).toHaveBeenCalledWith('managementProfile.profile.saved');
    expect(host().querySelector('input')).toBeNull();
    expect(host().textContent).toContain('Δημάκος');
  });

  describe('after a name change', () => {
    beforeEach(() => {
      // Real time still moves, so `settle` works. The waits between refreshes are skipped.
      vi.useFakeTimers({ shouldAdvanceTime: true });
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    async function rename(): Promise<void> {
      await render();
      api.update.mockReturnValue(of(Result.Ok({ ...USER, firstName: 'Αριστείδης' })));
      await edit();
      type(input('given-name'), 'Αριστείδης');
      await submit();
    }

    it('refreshes the session until the claims carry the new name', async () => {
      // The sign-in provider gets the name a moment after the API, so the first refreshes
      // still bring back the old one.
      session.refresh.mockResolvedValueOnce(true).mockImplementationOnce(() => {
        claims.set({ givenName: 'Αριστείδης', familyName: 'Δημάκης', emailVerified: true });
        return Promise.resolve(true);
      });

      await rename();
      expect(session.refresh).toHaveBeenCalledOnce();

      await vi.advanceTimersByTimeAsync(1000);
      expect(session.refresh).toHaveBeenCalledTimes(2);

      await vi.advanceTimersByTimeAsync(10_000);
      expect(session.refresh).toHaveBeenCalledTimes(2);
    });

    it('stops after the last wait when the claims never catch up', async () => {
      await rename();

      await vi.advanceTimersByTimeAsync(60_000);

      expect(session.refresh).toHaveBeenCalledTimes(4);
    });

    it('stops when the session ends', async () => {
      session.refresh.mockResolvedValueOnce(false);

      await rename();
      await vi.advanceTimersByTimeAsync(60_000);

      expect(session.refresh).toHaveBeenCalledOnce();
    });
  });

  it('reads the profile once', async () => {
    await render();

    expect(api.current).toHaveBeenCalledOnce();
  });

  it('gives focus back to Edit after a save, because the Save button goes away', async () => {
    await render();
    api.update.mockReturnValue(of(Result.Ok({ ...USER, lastName: 'Δημάκος' })));

    await edit();
    type(input('family-name'), 'Δημάκος');
    button('managementProfile.actions.save').focus();
    await submit();

    expect(document.activeElement).toBe(button('managementProfile.actions.edit'));
  });

  it('gives focus back to Edit after Cancel', async () => {
    await render();

    await edit();
    button('managementProfile.actions.cancel').click();
    await settle();

    expect(document.activeElement).toBe(button('managementProfile.actions.edit'));
  });

  it('sends nothing for an unchanged form and returns to view', async () => {
    await render();

    await edit();
    await submit();

    expect(api.update).not.toHaveBeenCalled();
    expect(toaster.success).not.toHaveBeenCalled();
    expect(host().querySelector('input')).toBeNull();
  });

  it('refuses an invalid name before it sends anything', async () => {
    await render();

    await edit();
    type(input('given-name'), '<b>');
    await submit();

    expect(api.update).not.toHaveBeenCalled();
    expect(host().textContent).toContain('managementProfile.profile.errors.nameSymbols');
  });

  it('puts USER_INVALID_NAME on the name field', async () => {
    await render();
    const error: HttpError = {
      errorCode: 'VALIDATION_FAILED',
      httpCode: 400,
      validationErrors: [
        { code: 'USER_INVALID_NAME', description: 'Server name rule', propertyName: 'firstName' },
      ],
    };
    api.update.mockReturnValue(of(Result.Fail(error)));

    await edit();
    type(input('given-name'), 'Άρης Β');
    await submit();

    expect(input('given-name').getAttribute('aria-invalid')).toBe('true');
    expect(host().textContent).toContain('Server name rule');
    expect(toaster.error).not.toHaveBeenCalled();
  });

  it('keeps the form open with a toast on any other failure', async () => {
    await render();
    api.update.mockReturnValue(
      of(Result.Fail({ errorCode: 'HTTP_500', httpCode: 500, validationErrors: [] })),
    );

    await edit();
    type(input('given-name'), 'Αριστείδης');
    await submit();

    expect(toaster.error).toHaveBeenCalledWith('managementProfile.profile.saveFailed');
    expect(input('given-name').value).toBe('Αριστείδης');
  });

  it('asks before leaving with unsaved edits, and drops them on discard', async () => {
    await render();
    const editors = TestBed.inject(PageEditors);

    expect(await editors.canLeave()).toBe(true);
    expect(confirmation.open).not.toHaveBeenCalled();

    await edit();
    type(input('given-name'), 'Αριστείδης');
    await settle();
    expect(editors.hasChanges()).toBe(true);

    confirmation.open.mockResolvedValueOnce('cancelled');
    expect(await editors.canLeave()).toBe(false);

    expect(await editors.canLeave()).toBe(true);
    await settle();
    expect(host().querySelector('input')).toBeNull();
    expect(host().textContent).toContain('Άρης');
  });

  it('links to the password page with a return to this page', async () => {
    await render();

    const link = host().querySelector<HTMLAnchorElement>('a[libbutton]');
    expect(link?.getAttribute('href')).toBe(
      '/auth/account/password?returnUrl=%2Fmanagement%2Fprofile',
    );
  });

  describe('back from the password page', () => {
    it.each([
      ['success', 'success', 'managementProfile.profile.password.updated'],
      ['error', 'error', 'managementProfile.profile.password.failed'],
    ] as const)('toasts %s and strips the parameter', async (status, kind, key) => {
      await render(`/management/profile?kc_action_status=${status}`);
      await settle();

      expect(toaster[kind]).toHaveBeenCalledWith(key);
      expect(TestBed.inject(Router).url).toBe('/management/profile');
    });

    it('only strips a cancelled one', async () => {
      await render('/management/profile?kc_action_status=cancelled');
      await settle();

      expect(toaster.success).not.toHaveBeenCalled();
      expect(toaster.error).not.toHaveBeenCalled();
      expect(TestBed.inject(Router).url).toBe('/management/profile');
    });
  });
});
