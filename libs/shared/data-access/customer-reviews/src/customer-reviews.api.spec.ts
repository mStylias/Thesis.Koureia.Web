import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideSynaxApi } from '@synax/client';

import { CustomerReviewsApi } from './customer-reviews.api';

describe('CustomerReviewsApi', () => {
  let api: CustomerReviewsApi;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideSynaxApi({ baseUrl: 'https://api.test', defaultVersion: 1 }),
      ],
    });
    api = TestBed.inject(CustomerReviewsApi);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    http.verify();
  });

  it('reviews a visit through its appointment', () => {
    api.create('a1', { rating: 5, comment: null }, 'el').subscribe();

    const request = http.expectOne(
      (req) => req.url === 'https://api.test/api/v1/users/me/appointments/a1/review',
    );
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual({ rating: 5, comment: null });
  });

  it('patches only what changed', () => {
    api.update('r1', { rating: 3 }, 'el').subscribe();

    const request = http.expectOne(
      (req) => req.url === 'https://api.test/api/v1/users/me/reviews/r1',
    );
    expect(request.request.method).toBe('PATCH');
    expect(request.request.body).toEqual({ rating: 3 });
  });

  it('deletes by review id', () => {
    api.delete('r1').subscribe();

    const request = http.expectOne('https://api.test/api/v1/users/me/reviews/r1');
    expect(request.request.method).toBe('DELETE');
  });
});
