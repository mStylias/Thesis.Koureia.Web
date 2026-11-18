import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Injectable, signal } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import {
  TranslocoService,
  provideTransloco,
  type Translation,
  type TranslocoLoader,
} from '@jsverse/transloco';
import { LANGUAGE_PREFERENCE } from '@features/language';
import { PushReminders, type PushState } from '@features/reminders';
import { provideSynaxApi } from '@synax/client';
import { ToasterService } from '@ui/toaster';
import { BRAND } from '@util/brand';
import { firstValueFrom, of, type Observable } from 'rxjs';

import { accountInlineLoader } from '../account.i18n';
import el from '../i18n/el';
import { AccountSettings } from './account-settings';

@Injectable()
class EmptyLoader implements TranslocoLoader {
  getTranslation(): Observable<Translation> {
    return of({});
  }
}

const PROFILE_URL = 'https://api.test/api/v1/users/me';

/** The Greek text of an `account.settings.reminders` key. */
function t(key: string): string {
  const settings = el['settings'] as Translation;
  const value: unknown = (settings['reminders'] as Translation)[key];
  if (typeof value !== 'string') throw new Error(`${key} is not a string`);
  return value;
}

describe('AccountSettings', () => {
  let fixture: ComponentFixture<AccountSettings>;
  let http: HttpTestingController;
  const state = signal<PushState>('unknown');
  const push = {
    state,
    platform: signal(null),
    check: vi.fn(() => Promise.resolve()),
    enable: vi.fn(() => Promise.resolve('on')),
    disable: vi.fn(() => Promise.resolve()),
    sendTest: vi.fn(() => Promise.resolve('sent')),
  };

  beforeEach(async () => {
    state.set('unknown');
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideSynaxApi({ baseUrl: 'https://api.test', defaultVersion: 1 }),
        provideTransloco({
          config: { availableLangs: ['el', 'en'], defaultLang: 'el' },
          loader: EmptyLoader,
        }),
        { provide: PushReminders, useValue: push },
        { provide: BRAND, useValue: { logo: '/brand/test.png' } },
        { provide: LANGUAGE_PREFERENCE, useValue: { persist: () => Promise.resolve() } },
      ],
    });
    http = TestBed.inject(HttpTestingController);
    await firstValueFrom(
      TestBed.inject(TranslocoService).load('account/el', { inlineLoader: accountInlineLoader }),
    );
    fixture = TestBed.createComponent(AccountSettings);
    fixture.detectChanges();
    http.expectOne(PROFILE_URL).flush({ email: 'person@example.com', emailRemindersEnabled: true });
    await settle();
  });

  afterEach(() => {
    http.verify();
    vi.clearAllMocks();
  });

  async function settle(): Promise<void> {
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  async function show(pushState: PushState): Promise<void> {
    state.set(pushState);
    await settle();
  }

  function text(): string {
    return (fixture.nativeElement as HTMLElement).textContent;
  }

  function buttons(): string[] {
    return Array.from((fixture.nativeElement as HTMLElement).querySelectorAll('button')).map(
      (button) => button.textContent.trim(),
    );
  }

  function emailSwitch(): HTMLInputElement {
    const input = (fixture.nativeElement as HTMLElement).querySelector<HTMLInputElement>(
      'lib-switch input',
    );
    if (input === null) throw new Error('email switch not rendered');
    return input;
  }

  it('says when the reminders come, and shows the address under the email switch', () => {
    expect(text()).toContain(t('hint'));
    expect(emailSwitch().checked).toBe(true);
    expect(text()).toContain('person@example.com');
  });

  it('shows no device row until the state is known', () => {
    expect(text()).not.toContain(t('device'));
  });

  it.each<PushState>(['available', 'off'])('offers to turn push on when %s', async (s) => {
    await show(s);

    expect(buttons()).toContain(t('enable'));
  });

  it('shows "On" with a test and a way off', async () => {
    await show('on');

    expect(text()).toContain(t('on'));
    expect(buttons()).toEqual(expect.arrayContaining([t('test'), t('disable')]));
  });

  it('explains a blocked browser and offers the guide', async () => {
    await show('blocked');

    expect(text()).toContain(t('blocked'));
    expect(buttons()).toContain(t('guide'));
  });

  it('offers the guide on an iPhone outside the Home Screen and in an in-app browser', async () => {
    await show('needs-home-screen');
    expect(text()).toContain('brand.reminders.iphoneLine');
    expect(buttons()).toContain(t('guide'));

    await show('in-app-browser');
    expect(text()).toContain(t('inApp'));
    expect(buttons()).toContain(t('guide'));
  });

  it('says the emails still come when the browser cannot push', async () => {
    await show('unsupported');

    expect(text()).toContain(t('unsupported'));
    expect(buttons()).not.toContain(t('enable'));
  });

  it('sends a test, with a toast', async () => {
    const success = vi.spyOn(TestBed.inject(ToasterService), 'success');
    await show('on');

    Array.from((fixture.nativeElement as HTMLElement).querySelectorAll('button'))
      .find((button) => button.textContent.includes(t('test')))
      ?.click();
    await settle();

    expect(push.sendTest).toHaveBeenCalledOnce();
    expect(success).toHaveBeenCalledWith(t('testSent'));
  });

  it('saves the email switch on change', async () => {
    emailSwitch().click();
    await settle();

    const request = http.expectOne(PROFILE_URL);
    expect(request.request.method).toBe('PATCH');
    expect(request.request.body).toEqual({ emailRemindersEnabled: false });
    request.flush({ email: 'person@example.com', emailRemindersEnabled: false });
    await settle();

    expect(emailSwitch().checked).toBe(false);
  });

  it('puts the switch back and says so when the save fails', async () => {
    const error = vi.spyOn(TestBed.inject(ToasterService), 'error');

    emailSwitch().click();
    await settle();
    http
      .expectOne(PROFILE_URL)
      .flush({ title: 'ERR', status: 500 }, { status: 500, statusText: 'Server Error' });
    await settle();

    expect(emailSwitch().checked).toBe(true);
    expect(error).toHaveBeenCalledWith(t('emailFailed'));
  });
});
