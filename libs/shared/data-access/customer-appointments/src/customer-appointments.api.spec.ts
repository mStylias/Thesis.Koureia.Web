import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideSynaxApi } from '@synax/client';
import type { HttpError } from '@synax/client/core';
import { firstValueFrom } from 'rxjs';

import { CustomerAppointmentsApi, readPriceChange } from './customer-appointments.api';

describe('CustomerAppointmentsApi', () => {
  let api: CustomerAppointmentsApi;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideSynaxApi({ baseUrl: 'https://api.test', defaultVersion: 1 }),
      ],
    });
    api = TestBed.inject(CustomerAppointmentsApi);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    http.verify();
  });

  it('asks for one page of one period in one language', () => {
    api.list({ period: 'Past', page: 2, pageSize: 20, languageCode: 'el' }).subscribe();

    const request = http.expectOne(
      (req) => req.url === 'https://api.test/api/v1/users/me/appointments',
    );
    expect(request.request.params.get('period')).toBe('Past');
    expect(request.request.params.get('page')).toBe('2');
    expect(request.request.params.get('pageSize')).toBe('20');
    expect(request.request.params.get('languageCode')).toBe('el');
  });

  it('posts the reason to the cancel route', () => {
    api.cancel('a1', { reason: 'Sick' }, 'en').subscribe();

    const request = http.expectOne(
      (req) => req.url === 'https://api.test/api/v1/users/me/appointments/a1/cancel',
    );
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual({ reason: 'Sick' });
  });

  it('reads the new total from a refused move', async () => {
    const result = firstValueFrom(
      api.reschedule(
        'a1',
        {
          serviceIds: ['s1'],
          staffMemberId: null,
          startsAtUtc: '2026-10-10T10:00:00Z',
          notes: null,
          expectedTotalPrice: 20,
        },
        'en',
      ),
    );

    http
      .expectOne((req) => req.url === 'https://api.test/api/v1/users/me/appointments/a1/reschedule')
      .flush(
        { title: 'APPOINTMENT_PRICE_CHANGED', status: 409, totalPrice: 25, currency: 'EUR' },
        { status: 409, statusText: 'Conflict' },
      );

    const refused = await result;
    expect(refused.isFailure).toBe(true);
    expect(refused.error === null ? null : readPriceChange(refused.error)).toEqual({
      totalPrice: 25,
      currency: 'EUR',
    });
  });

  it('reads no price change from any other refusal', () => {
    const error: HttpError = {
      errorCode: 'APPOINTMENT_SLOT_TAKEN',
      httpCode: 409,
      validationErrors: [],
      raw: { totalPrice: 25, currency: 'EUR' },
    };
    expect(readPriceChange(error)).toBeNull();
  });
});
