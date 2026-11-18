import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Injectable, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import {
  TranslocoService,
  provideTransloco,
  type Translation,
  type TranslocoLoader,
} from '@jsverse/transloco';
import { provideSynaxApi } from '@synax/client';
import { firstValueFrom, of, type Observable } from 'rxjs';

import el from '../i18n/el';
import { REMINDERS_ACCOUNT } from '../reminders-account';
import { remindersInlineLoader } from '../reminders.i18n';
import { RemindersUnsubscribe } from './reminders-unsubscribe';

@Injectable()
class EmptyLoader implements TranslocoLoader {
  getTranslation(): Observable<Translation> {
    return of({});
  }
}

const API = 'https://api.test/api/v1/reminders';

/** The Greek text of a `reminders.unsubscribe` key. */
function t(key: string): string {
  const value: unknown = (el['unsubscribe'] as Translation)[key];
  if (typeof value !== 'string') throw new Error(`${key} is not a string`);
  return value;
}

describe('RemindersUnsubscribe', () => {
  let harness: RouterTestingHarness;
  let http: HttpTestingController;
  const signedIn = signal(false);

  beforeEach(async () => {
    signedIn.set(false);
    TestBed.configureTestingModule({
      providers: [
        provideRouter([{ path: 'unsubscribe', component: RemindersUnsubscribe }]),
        provideHttpClient(),
        provideHttpClientTesting(),
        provideSynaxApi({ baseUrl: 'https://api.test', defaultVersion: 1 }),
        provideTransloco({
          config: { availableLangs: ['el', 'en'], defaultLang: 'el' },
          loader: EmptyLoader,
        }),
        { provide: REMINDERS_ACCOUNT, useValue: { signedIn, verified: signedIn } },
      ],
    });
    http = TestBed.inject(HttpTestingController);
    await firstValueFrom(
      TestBed.inject(TranslocoService).load('reminders/el', {
        inlineLoader: remindersInlineLoader,
      }),
    );
    harness = await RouterTestingHarness.create();
  });

  afterEach(() => {
    http.verify();
  });

  async function open(url: string): Promise<void> {
    await harness.navigateByUrl(url);
    harness.detectChanges();
    await harness.fixture.whenStable();
  }

  async function settle(): Promise<void> {
    harness.detectChanges();
    await harness.fixture.whenStable();
    harness.detectChanges();
  }

  function answer(method: 'GET' | 'POST', path: string, enabled: boolean, hasAccount = true): void {
    http
      .expectOne((request) => request.method === method && request.url === `${API}/${path}`)
      .flush({ maskedEmail: 'e•••@example.com', emailRemindersEnabled: enabled, hasAccount });
  }

  function text(): string {
    return harness.routeNativeElement?.textContent ?? '';
  }

  function press(label: string): void {
    const button = Array.from(
      harness.routeNativeElement?.querySelectorAll<HTMLButtonElement>('button') ?? [],
    ).find((candidate) => candidate.textContent.includes(label));
    if (button === undefined) throw new Error(`${label} not rendered`);
    button.click();
  }

  it('only reads the token when it opens', async () => {
    await open('/unsubscribe?token=t1');

    const read = http.expectOne((request) => request.url === `${API}/unsubscribe`);
    expect(read.request.method).toBe('GET');
    expect(read.request.params.get('token')).toBe('t1');
    read.flush({ maskedEmail: 'e•••@example.com', emailRemindersEnabled: true, hasAccount: false });
    await settle();

    expect(text()).toContain(t('question'));
    expect(text()).toContain('e•••@example.com');
    http.expectNone((request) => request.method === 'POST');
  });

  it('turns the emails off, and undoes it', async () => {
    await open('/unsubscribe?token=t1');
    answer('GET', 'unsubscribe', true);
    await settle();

    press(t('stop'));
    const off = http.expectOne((request) => request.method === 'POST');
    expect(off.request.url).toBe(`${API}/unsubscribe`);
    expect(off.request.body).toEqual({ token: 't1' });
    off.flush({ maskedEmail: 'e•••@example.com', emailRemindersEnabled: false, hasAccount: true });
    await settle();

    expect(text()).toContain(t('done'));
    press(t('undo'));
    answer('POST', 'resubscribe', true);
    await settle();

    expect(text()).toContain(t('resubscribed'));
  });

  it('offers to turn the emails on again when they are already off', async () => {
    await open('/unsubscribe?token=t1');
    answer('GET', 'unsubscribe', false);
    await settle();

    expect(text()).toContain(t('done'));
    expect(text()).toContain(t('resubscribe'));
    expect(text()).toContain(t('settings'));
  });

  it('says a bad token is not valid, and offers Settings only to a signed-in visitor', async () => {
    await open('/unsubscribe?token=bad');
    http
      .expectOne(`${API}/unsubscribe?token=bad`)
      .flush(
        { title: 'REMINDERS_INVALID_TOKEN', status: 404 },
        { status: 404, statusText: 'Not Found' },
      );
    await settle();

    expect(text()).toContain(t('invalid'));
    expect(text()).not.toContain(t('settings'));

    signedIn.set(true);
    await settle();
    expect(text()).toContain(t('settings'));
  });

  it('asks nothing without a token', async () => {
    await open('/unsubscribe');

    expect(text()).toContain(t('invalid'));
    http.expectNone(`${API}/unsubscribe`);
  });
});
