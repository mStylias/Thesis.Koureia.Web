import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideSynaxApi } from '@synax/client';
import { firstValueFrom } from 'rxjs';

import { UserDevicesApi } from './user-devices.api';

describe('UserDevicesApi', () => {
  let api: UserDevicesApi;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideSynaxApi({ baseUrl: 'https://api.test', defaultVersion: 1 }),
      ],
    });
    api = TestBed.inject(UserDevicesApi);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    http.verify();
  });

  it('reads the public key', async () => {
    const result = firstValueFrom(api.publicKey());

    const request = http.expectOne('https://api.test/api/v1/reminders/push/public-key');
    expect(request.request.method).toBe('GET');
    request.flush({ publicKey: 'BKey' });

    await expect(result).resolves.toMatchObject({ isSuccess: true, data: { publicKey: 'BKey' } });
  });

  it('answers a push-less environment with its code', async () => {
    const result = firstValueFrom(api.publicKey());

    http
      .expectOne('https://api.test/api/v1/reminders/push/public-key')
      .flush(
        { title: 'REMINDERS_PUSH_NOT_CONFIGURED', status: 503 },
        { status: 503, statusText: 'Service Unavailable' },
      );

    await expect(result).resolves.toMatchObject({
      isSuccess: false,
      error: { errorCode: 'REMINDERS_PUSH_NOT_CONFIGURED', httpCode: 503 },
    });
  });

  it('registers the browser with a PUT', () => {
    api
      .register({
        endpoint: 'https://push.example/1',
        keys: { p256dh: 'p', auth: 'a' },
        label: 'Chrome · Android',
        platform: 'web',
      })
      .subscribe();

    const request = http.expectOne('https://api.test/api/v1/users/me/push-devices');
    expect(request.request.method).toBe('PUT');
    expect(request.request.body).toMatchObject({
      endpoint: 'https://push.example/1',
      platform: 'web',
    });
  });

  it('unregisters and tests by endpoint', () => {
    api.unregister('https://push.example/1').subscribe();
    api.sendTest('https://push.example/1').subscribe();

    const unregister = http.expectOne('https://api.test/api/v1/users/me/push-devices/unregister');
    expect(unregister.request.method).toBe('POST');
    expect(unregister.request.body).toEqual({ endpoint: 'https://push.example/1' });

    const test = http.expectOne('https://api.test/api/v1/users/me/push-devices/test');
    expect(test.request.method).toBe('POST');
    expect(test.request.body).toEqual({ endpoint: 'https://push.example/1' });
  });
});
