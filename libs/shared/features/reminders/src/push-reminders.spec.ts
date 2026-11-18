import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideSynaxApi } from '@synax/client';

import { decodeBase64Url } from './core/base64url';
import { detectPushEnvironment } from './core/push-environment';
import { PushBrowser } from './push-browser';
import { PushReminders } from './push-reminders';
import { REMINDERS_ACCOUNT } from './reminders-account';

const API = 'https://api.test/api/v1';
const KEY = 'AQID';
const OLD_KEY = 'BAUG';

const desktop = detectPushEnvironment({
  userAgent:
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  maxTouchPoints: 0,
  standalone: false,
  pushApi: true,
});

/** A browser with a push manager that keeps one subscription, as a real one does. */
function fakeBrowser(options: {
  permission?: NotificationPermission;
  answer?: NotificationPermission;
}) {
  let permission = options.permission ?? 'default';
  let current: ReturnType<typeof subscription> | null = null;
  let registered = false;

  function subscription(endpoint: string, key: string) {
    const created = {
      endpoint,
      options: { applicationServerKey: decodeBase64Url(key).buffer },
      unsubscribe: vi.fn(() => {
        if (current === created) current = null;
        return Promise.resolve(true);
      }),
      toJSON: () => ({ endpoint, keys: { p256dh: 'p256', auth: 'auth' } }),
    };
    return created;
  }

  const pushManager = {
    getSubscription: vi.fn(() => Promise.resolve(current)),
    subscribe: vi.fn((init: { applicationServerKey: Uint8Array }) => {
      const key = btoa(String.fromCharCode(...init.applicationServerKey));
      current = subscription('https://push.example/new', key);
      return Promise.resolve(current);
    }),
  };
  const registration = { pushManager };

  const browser = {
    environment: vi.fn(() => desktop),
    permission: vi.fn(() => permission),
    requestPermission: vi.fn(() => {
      permission = options.answer ?? 'granted';
      return Promise.resolve(permission);
    }),
    onPermissionChange: vi.fn(),
    registration: vi.fn(() => Promise.resolve(registered ? registration : null)),
    registerWorker: vi.fn(() => {
      registered = true;
      return Promise.resolve(registration);
    }),
  };

  return {
    browser,
    pushManager,
    /** An earlier visit left this subscription. */
    existing(key: string) {
      registered = true;
      current = subscription('https://push.example/old', key);
      return current;
    },
    current: () => current,
  };
}

describe('PushReminders', () => {
  let http: HttpTestingController;
  const verified = signal(false);

  function setup(fake: ReturnType<typeof fakeBrowser>): PushReminders {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideSynaxApi({ baseUrl: 'https://api.test', defaultVersion: 1 }),
        { provide: PushBrowser, useValue: fake.browser },
        { provide: REMINDERS_ACCOUNT, useValue: { signedIn: verified, verified } },
      ],
    });
    http = TestBed.inject(HttpTestingController);
    return TestBed.inject(PushReminders);
  }

  async function answerKey(): Promise<void> {
    const request = await vi.waitFor(() => http.expectOne(`${API}/reminders/push/public-key`));
    request.flush({ publicKey: KEY });
  }

  async function answerRegister(status = 200, errorCode = ''): Promise<unknown> {
    const request = await vi.waitFor(() => http.expectOne(`${API}/users/me/push-devices`));
    if (status === 200) {
      request.flush({ id: 'd1', label: null, platform: 'web', lastSeenAt: '2026-10-10T10:00:00Z' });
    } else {
      request.flush({ title: errorCode, status }, { status, statusText: 'Error' });
    }
    return request.request.body;
  }

  afterEach(() => {
    http.verify();
    verified.set(false);
  });

  it('is available once the browser and the API are read', async () => {
    const push = setup(fakeBrowser({}));

    const check = push.check();
    await answerKey();
    await check;

    expect(push.state()).toBe('available');
  });

  it('is unsupported everywhere when the API has no push keys', async () => {
    const push = setup(fakeBrowser({}));

    const check = push.check();
    const request = await vi.waitFor(() => http.expectOne(`${API}/reminders/push/public-key`));
    request.flush(
      { title: 'REMINDERS_PUSH_NOT_CONFIGURED', status: 503 },
      { status: 503, statusText: 'Service Unavailable' },
    );
    await check;

    expect(push.state()).toBe('unsupported');
  });

  it('asks first, then subscribes with the key and registers the browser', async () => {
    const fake = fakeBrowser({});
    const push = setup(fake);
    const check = push.check();
    await answerKey();
    await check;

    const enabling = push.enable();
    // The question is asked in the click, before anything is awaited.
    expect(fake.browser.requestPermission).toHaveBeenCalledOnce();
    const body = await answerRegister();

    await expect(enabling).resolves.toBe('on');
    expect(fake.pushManager.subscribe).toHaveBeenCalledWith(
      expect.objectContaining({ userVisibleOnly: true }),
    );
    expect(body).toEqual({
      endpoint: 'https://push.example/new',
      keys: { p256dh: 'p256', auth: 'auth' },
      label: 'Chrome · Windows',
      platform: 'web',
    });
    expect(push.state()).toBe('on');
  });

  it('stops when the question is refused, and subscribes nothing', async () => {
    const fake = fakeBrowser({ answer: 'denied' });
    const push = setup(fake);

    await expect(push.enable()).resolves.toBe('blocked');

    expect(fake.pushManager.subscribe).not.toHaveBeenCalled();
    http.expectNone(`${API}/users/me/push-devices`);
  });

  it('removes the browser subscription again when the API refuses it', async () => {
    const fake = fakeBrowser({});
    const push = setup(fake);

    const enabling = push.enable();
    await answerKey();
    await answerRegister(400, 'REMINDERS_INVALID_SUBSCRIPTION');

    await expect(enabling).resolves.toBe('failed');
    expect(fake.current()).toBeNull();
  });

  it('retries a register conflict once', async () => {
    const fake = fakeBrowser({});
    const push = setup(fake);

    const enabling = push.enable();
    await answerKey();
    await answerRegister(409, 'REMINDERS_DEVICE_REGISTER_CONFLICT');
    await answerRegister();

    await expect(enabling).resolves.toBe('on');
  });

  it('turns off in the API and in the browser, even when the API call fails', async () => {
    const fake = fakeBrowser({ permission: 'granted' });
    const existing = fake.existing(KEY);
    const push = setup(fake);

    const disabling = push.disable();
    const request = await vi.waitFor(() =>
      http.expectOne(`${API}/users/me/push-devices/unregister`),
    );
    expect(request.request.body).toEqual({ endpoint: 'https://push.example/old' });
    request.error(new ProgressEvent('error'));
    await disabling;

    expect(existing.unsubscribe).toHaveBeenCalledOnce();
    expect(fake.current()).toBeNull();
  });

  it('registers the existing subscription again when a verified customer is signed in', async () => {
    const fake = fakeBrowser({ permission: 'granted' });
    fake.existing(KEY);
    const push = setup(fake);

    push.start();
    verified.set(true);
    TestBed.tick();
    await answerKey();
    const body = await answerRegister();

    expect(body).toMatchObject({ endpoint: 'https://push.example/old' });
    expect(fake.pushManager.subscribe).not.toHaveBeenCalled();
  });

  it('subscribes again when the API key changed', async () => {
    const fake = fakeBrowser({ permission: 'granted' });
    const old = fake.existing(OLD_KEY);
    const push = setup(fake);

    const syncing = push.sync();
    await answerKey();
    const body = await answerRegister();
    await syncing;

    expect(old.unsubscribe).toHaveBeenCalledOnce();
    expect(body).toMatchObject({ endpoint: 'https://push.example/new' });
  });

  it('registers the browser and tries the test once more when the API does not know it', async () => {
    const fake = fakeBrowser({ permission: 'granted' });
    fake.existing(KEY);
    const push = setup(fake);

    const testing = push.sendTest();
    const first = await vi.waitFor(() => http.expectOne(`${API}/users/me/push-devices/test`));
    first.flush(
      { title: 'REMINDERS_DEVICE_NOT_FOUND', status: 404 },
      { status: 404, statusText: 'Not Found' },
    );
    await answerRegister();
    const second = await vi.waitFor(() => http.expectOne(`${API}/users/me/push-devices/test`));
    second.flush(null, { status: 204, statusText: 'No Content' });

    await expect(testing).resolves.toBe('sent');
  });

  it('drops the browser subscription when the push service says it is gone', async () => {
    const fake = fakeBrowser({ permission: 'granted' });
    const existing = fake.existing(KEY);
    const push = setup(fake);

    const testing = push.sendTest();
    const request = await vi.waitFor(() => http.expectOne(`${API}/users/me/push-devices/test`));
    request.flush(
      { title: 'REMINDERS_SUBSCRIPTION_GONE', status: 410 },
      { status: 410, statusText: 'Gone' },
    );

    await expect(testing).resolves.toBe('gone');
    expect(existing.unsubscribe).toHaveBeenCalledOnce();
  });

  it('reports the hourly test limit', async () => {
    const fake = fakeBrowser({ permission: 'granted' });
    fake.existing(KEY);
    const push = setup(fake);

    const testing = push.sendTest();
    const request = await vi.waitFor(() => http.expectOne(`${API}/users/me/push-devices/test`));
    request.flush(
      { title: 'REMINDERS_TEST_PUSH_RATE_LIMITED', status: 429 },
      { status: 429, statusText: 'Too Many Requests', headers: { 'Retry-After': '3600' } },
    );

    await expect(testing).resolves.toBe('rate-limited');
  });
});
