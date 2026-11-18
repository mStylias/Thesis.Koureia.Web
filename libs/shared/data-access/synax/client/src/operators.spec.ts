import { HttpClient, provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom, map, of, timeout } from 'rxjs';
import { HttpError, Result, SyntheticErrorCodes } from '@synax/client/core';
import { hasBody, toResult, toResultResponse } from './index';

interface Booking {
  id: string;
  guestName: string;
}

function setup(): { http: HttpClient; controller: HttpTestingController } {
  TestBed.configureTestingModule({
    providers: [provideHttpClient(), provideHttpClientTesting()],
  });
  return { http: TestBed.inject(HttpClient), controller: TestBed.inject(HttpTestingController) };
}

describe('toResult', () => {
  let http: HttpClient;
  let controller: HttpTestingController;

  beforeEach(() => ({ http, controller } = setup()));
  afterEach(() => {
    controller.verify();
  });

  it('maps 200 with body to Result.Ok(data)', async () => {
    const pending = firstValueFrom(http.get<Booking>('/api/v1/bookings/1').pipe(toResult()));
    controller.expectOne('/api/v1/bookings/1').flush({ id: '1', guestName: 'Ada' });

    const result = await pending;
    expect(result.isSuccess).toBe(true);
    expect(Result.hasData(result) && result.data.guestName).toBe('Ada');
  });

  it('maps 204 (null body) to a void success', async () => {
    const pending = firstValueFrom(http.delete<void>('/api/v1/tables/1').pipe(toResult()));
    controller.expectOne('/api/v1/tables/1').flush(null, { status: 204, statusText: 'No Content' });

    const result = await pending;
    expect(result.isSuccess).toBe(true);
    expect(result.data).toBeNull();
  });

  it('maps a problem response to Result.Fail without erroring the stream', async () => {
    const pending = firstValueFrom(http.get<Booking>('/api/v1/bookings/9').pipe(toResult()));
    controller.expectOne('/api/v1/bookings/9').flush(
      { title: 'BOOKING_NOT_FOUND', status: 404, detail: 'No booking with that id.' },
      {
        status: 404,
        statusText: 'Not Found',
        headers: { 'content-type': 'application/problem+json' },
      },
    );

    const result = await pending;
    expect(result.isFailure).toBe(true);
    if (result.isFailure) {
      expect(result.error.errorCode).toBe('BOOKING_NOT_FOUND');
      expect(result.error.httpCode).toBe(404);
      expect(result.error.description).toBe('No booking with that id.');
    }
  });

  it('maps validation problem responses including field errors', async () => {
    const pending = firstValueFrom(http.post<Booking>('/api/v1/bookings', {}).pipe(toResult()));
    controller.expectOne('/api/v1/bookings').flush(
      {
        title: 'VALIDATION_FAILED',
        status: 400,
        errors: [
          { code: 'REQUIRED', description: 'Guest name required.', propertyName: 'guestName' },
        ],
      },
      { status: 400, statusText: 'Bad Request' },
    );

    const result = await pending;
    expect(result.isFailure).toBe(true);
    if (result.isFailure) {
      expect(result.error.validationErrors).toEqual([
        {
          code: 'REQUIRED',
          description: 'Guest name required.',
          propertyName: 'guestName',
          innerErrors: undefined,
        },
      ]);
    }
  });

  it('maps network failures to NETWORK_ERROR', async () => {
    const pending = firstValueFrom(http.get<Booking>('/api/v1/bookings/1').pipe(toResult()));
    controller.expectOne('/api/v1/bookings/1').error(new ProgressEvent('error'));

    const result = await pending;
    expect(result.isFailure && result.error.errorCode).toBe(SyntheticErrorCodes.NetworkError);
    expect(result.isFailure && result.error.httpCode).toBe(0);
  });

  it('maps an RxJS timeout to TIMEOUT', async () => {
    const pending = firstValueFrom(
      http.get<Booking>('/api/v1/bookings/1').pipe(timeout(1), toResult()),
    );

    const result = await pending; // never flushed — the timeout fires
    expect(result.isFailure && result.error.errorCode).toBe(SyntheticErrorCodes.Timeout);
    controller.expectOne('/api/v1/bookings/1'); // consume the cancelled request
  });

  it('rethrows non-HTTP programming errors instead of converting them', async () => {
    const bug = new Error('a bug, not an HTTP failure');
    const pending = firstValueFrom(
      of(1).pipe(
        map(() => {
          throw bug;
        }),
        toResult(),
      ),
    );

    await expect(pending).rejects.toBe(bug);
  });
});

describe('toResultResponse', () => {
  let http: HttpClient;
  let controller: HttpTestingController;

  beforeEach(() => ({ http, controller } = setup()));
  afterEach(() => {
    controller.verify();
  });

  it('exposes status and Location for 201 Created', async () => {
    const pending = firstValueFrom(
      http.post<Booking>('/api/v1/bookings', {}, { observe: 'response' }).pipe(toResultResponse()),
    );
    controller
      .expectOne('/api/v1/bookings')
      .flush(
        { id: '42', guestName: 'Ada' },
        { status: 201, statusText: 'Created', headers: { Location: '/api/v1/bookings/42' } },
      );

    const result = await pending;
    expect(result.isSuccess).toBe(true);
    if (Result.hasData(result)) {
      expect(result.data.status).toBe(201);
      expect(result.data.location).toBe('/api/v1/bookings/42');
      expect(hasBody(result.data) && result.data.body.id).toBe('42');
    }
  });

  it('reports a 204 as a body-less response, which Result.hasData cannot express', async () => {
    const pending = firstValueFrom(
      http.post<Booking>('/api/v1/bookings', {}, { observe: 'response' }).pipe(toResultResponse()),
    );
    controller.expectOne('/api/v1/bookings').flush(null, { status: 204, statusText: 'No Content' });

    const result = await pending;
    expect(Result.hasData(result)).toBe(true); // the wrapper is always present
    expect(Result.hasData(result) && hasBody(result.data)).toBe(false);
    expect(Result.hasData(result) && result.data.status).toBe(204);
  });

  it('maps failures the same way as toResult', async () => {
    const pending = firstValueFrom(
      http.post<Booking>('/api/v1/bookings', {}, { observe: 'response' }).pipe(toResultResponse()),
    );
    controller
      .expectOne('/api/v1/bookings')
      .flush({ title: 'CONFLICT', status: 409 }, { status: 409, statusText: 'Conflict' });

    const result = await pending;
    expect(result.isFailure).toBe(true);
    if (result.isFailure) {
      const error: HttpError = result.error;
      expect(error.errorCode).toBe('CONFLICT');
    }
  });
});
