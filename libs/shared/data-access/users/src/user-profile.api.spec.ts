import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideSynaxApi } from '@synax/client';
import type { Subscribable } from 'rxjs';

import { UserProfileApi } from './user-profile.api';

describe('UserProfileApi', () => {
  let api: UserProfileApi;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideSynaxApi({ baseUrl: 'https://api.test', defaultVersion: 1 }),
      ],
    });
    api = TestBed.inject(UserProfileApi);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    http.verify();
  });

  it('patches the versioned /users/me route', () => {
    api.updatePreferredLanguage('en').subscribe();

    const request = http.expectOne('https://api.test/api/v1/users/me');
    expect(request.request.method).toBe('PATCH');
  });

  it('sends only the language, so the merge patch leaves the rest of the profile alone', () => {
    api.updatePreferredLanguage('en').subscribe();

    const request = http.expectOne('https://api.test/api/v1/users/me');
    expect(request.request.body).toEqual({ preferredLanguageCode: 'en' });
  });

  it('sends a code rather than an id, so nothing has to read the language table first', () => {
    api.updatePreferredLanguage('el').subscribe();

    const request = http.expectOne('https://api.test/api/v1/users/me');
    expect(request.request.body).toEqual({ preferredLanguageCode: 'el' });
  });

  it('sends only the email reminders flag when that is all that changed', () => {
    api.update({ emailRemindersEnabled: false }).subscribe();

    const request = http.expectOne('https://api.test/api/v1/users/me');
    expect(request.request.method).toBe('PATCH');
    expect(request.request.body).toEqual({ emailRemindersEnabled: false });
  });

  it('emits the updated profile', async () => {
    const profile = firstEmission(api.updatePreferredLanguage('en'));

    http.expectOne('https://api.test/api/v1/users/me').flush({
      id: 'user-1',
      keycloakId: 'sub-1',
      firstName: 'Given',
      lastName: 'Family',
      email: 'person@example.com',
      phoneNumber: null,
      language: { id: 'lang-1', code: 'en', name: 'English' },
      emailRemindersEnabled: true,
    });

    await expect(profile).resolves.toMatchObject({
      language: { code: 'en' },
    });
  });
});

function firstEmission<T>(source: Subscribable<T>): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    source.subscribe({ next: resolve, error: reject });
  });
}
