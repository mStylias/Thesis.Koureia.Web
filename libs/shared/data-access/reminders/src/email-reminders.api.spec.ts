import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideSynaxApi } from '@synax/client';

import { EmailRemindersApi } from './email-reminders.api';

describe('EmailRemindersApi', () => {
  let api: EmailRemindersApi;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideSynaxApi({ baseUrl: 'https://api.test', defaultVersion: 1 }),
      ],
    });
    api = TestBed.inject(EmailRemindersApi);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    http.verify();
  });

  it('reads with a GET that carries the token in the query', () => {
    api.read('t/1+').subscribe();

    const request = http.expectOne(
      (r) => r.url === 'https://api.test/api/v1/reminders/unsubscribe' && r.method === 'GET',
    );
    expect(request.request.params.get('token')).toBe('t/1+');
  });

  it('turns off and on with a POST of the token', () => {
    api.unsubscribe('t1').subscribe();
    api.resubscribe('t1').subscribe();

    const off = http.expectOne('https://api.test/api/v1/reminders/unsubscribe');
    expect(off.request.method).toBe('POST');
    expect(off.request.body).toEqual({ token: 't1' });

    const on = http.expectOne('https://api.test/api/v1/reminders/resubscribe');
    expect(on.request.method).toBe('POST');
    expect(on.request.body).toEqual({ token: 't1' });
  });
});
