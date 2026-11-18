import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideSynaxApi } from '@synax/client';
import type { HttpError } from '@synax/client/core';

import { CustomersApi } from './customers.api';
import { emailOwnerOf } from './customers-errors';

const API = 'https://api.test/api/v1';

describe('CustomersApi', () => {
  let api: CustomersApi;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideSynaxApi({ baseUrl: 'https://api.test', defaultVersion: 1 }),
      ],
    });
    api = TestBed.inject(CustomersApi);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    http.verify();
  });

  it('reads one customer by an encoded id', () => {
    api.customer('c 1').subscribe();

    expect(http.expectOne(`${API}/customers/c%201`).request.method).toBe('GET');
  });

  it('sends the patch body as given, so an absent member stays absent', () => {
    api.update('c1', { note: '', preferredStaffMemberId: null }).subscribe();

    const request = http.expectOne(`${API}/customers/c1`);
    expect(request.request.method).toBe('PATCH');
    expect(request.request.body).toEqual({ note: '', preferredStaffMemberId: null });
  });

  it('blocks with a reason and unblocks with no body', () => {
    api.block('c1', { reason: 'No-shows' }).subscribe();
    api.unblock('c1').subscribe();

    const block = http.expectOne(`${API}/customers/c1/block`);
    expect(block.request.method).toBe('POST');
    expect(block.request.body).toEqual({ reason: 'No-shows' });
    const unblock = http.expectOne(`${API}/customers/c1/unblock`);
    expect(unblock.request.method).toBe('POST');
    expect(unblock.request.body).toBeNull();
  });

  it('merges through the collection route', () => {
    api
      .merge({
        keptCustomerId: 'a',
        removedCustomerId: 'b',
        nameFrom: 'Kept',
        phoneFrom: 'Removed',
        emailFrom: 'Kept',
        preferredStaffFrom: 'Removed',
      })
      .subscribe();

    expect(http.expectOne(`${API}/customers/merge`).request.method).toBe('POST');
  });
});

describe('emailOwnerOf', () => {
  const error = (errorCode: string, raw: unknown): HttpError =>
    ({ errorCode, raw, httpCode: 409 }) as unknown as HttpError;

  it('reads the other walk-in from a parsed or a text body', () => {
    expect(emailOwnerOf(error('CUSTOMER_EMAIL_USED_BY_WALK_IN', { customerId: 'w2' }))).toBe('w2');
    expect(emailOwnerOf(error('CUSTOMER_EMAIL_USED_BY_WALK_IN', '{"customerId":"w3"}'))).toBe('w3');
  });

  it('answers null for another code or a body without the id', () => {
    expect(emailOwnerOf(error('CUSTOMER_EMAIL_USED_BY_ACCOUNT', { customerId: 'w2' }))).toBeNull();
    expect(emailOwnerOf(error('CUSTOMER_EMAIL_USED_BY_WALK_IN', {}))).toBeNull();
  });
});
