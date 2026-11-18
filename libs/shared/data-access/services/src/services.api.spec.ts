import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideSynaxApi } from '@synax/client';
import { firstValueFrom } from 'rxjs';

import { ServicesApi } from './services.api';
import type { CreateServiceRequest } from './services.types';

const API = 'https://api.test/api/v1';

const REQUEST: CreateServiceRequest = {
  categoryId: null,
  price: 16,
  durationMinutes: 30,
  bufferBeforeMinutes: 0,
  bufferAfterMinutes: 5,
  isActive: true,
  translations: [
    { languageCode: 'el', name: 'Κούρεμα', description: null },
    { languageCode: 'en', name: 'Haircut', description: null },
  ],
  staff: [{ staffMemberId: 's1', customPrice: null, customDurationMinutes: null }],
};

describe('ServicesApi', () => {
  let api: ServicesApi;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideSynaxApi({ baseUrl: 'https://api.test', defaultVersion: 1 }),
      ],
    });
    api = TestBed.inject(ServicesApi);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    http.verify();
  });

  it('appends the language after the OData query', () => {
    api.grid({ filter: 'isActive eq true', top: 25 }, 'el').subscribe();

    http
      .expectOne(`${API}/services/odata?$filter=isActive eq true&$top=25&languageCode=el`)
      .flush({ items: [], totalCount: 0 });
  });

  it('reads the options in the page language', () => {
    api.options('en').subscribe();
    http.expectOne(`${API}/services/options?languageCode=en`).flush({});
  });

  it('writes a service as a full body', () => {
    api.updateService('svc 1', REQUEST).subscribe();

    const request = http.expectOne(`${API}/services/svc%201`);
    expect(request.request.method).toBe('PUT');
    expect(request.request.body).toEqual(REQUEST);
    request.flush({});
  });

  it('reports a refused delete as a failed result', async () => {
    const result = firstValueFrom(api.deleteService('s1'));

    http
      .expectOne(`${API}/services/s1`)
      .flush({ status: 409, title: 'SERVICE_IN_USE' }, { status: 409, statusText: 'Conflict' });

    const answered = await result;
    expect(answered.isSuccess).toBe(false);
    expect(answered.isSuccess ? null : answered.error.errorCode).toBe('SERVICE_IN_USE');
  });

  it('names a category in the language the request passes', () => {
    api.createCategory({ translations: [] }, 'el').subscribe();

    const request = http.expectOne(`${API}/services/categories?languageCode=el`);
    expect(request.request.method).toBe('POST');
    request.flush({});
  });
});
