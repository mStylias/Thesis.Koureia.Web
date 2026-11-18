import { Injector, runInInjectionContext } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { HttpError } from '@synax/client/core';
import { injectErrorMessageResolver, provideSynaxErrorMessages, resolveMessage } from './index';

const error = (overrides: Partial<HttpError> = {}): HttpError => ({
  errorCode: 'BOOKING_NOT_FOUND',
  httpCode: 404,
  validationErrors: [],
  ...overrides,
});

describe('resolveMessage', () => {
  it('resolves by errorCode first', () => {
    const message = resolveMessage(error(), {
      codes: { BOOKING_NOT_FOUND: 'That booking does not exist.' },
      byStatus: { 404: 'Not found.' },
    });

    expect(message).toBe('That booking does not exist.');
  });

  it('falls back to status, then registry fallback', () => {
    const messages = { byStatus: { 404: 'Not found.' }, fallback: 'Something went wrong.' };

    expect(resolveMessage(error(), messages)).toBe('Not found.');
    expect(resolveMessage(error({ httpCode: 500 }), messages)).toBe('Something went wrong.');
  });

  it('supports function messages for interpolation', () => {
    const message = resolveMessage(error({ description: 'gone' }), {
      codes: { BOOKING_NOT_FOUND: (e) => `Server said: ${e.description}` },
    });

    expect(message).toBe('Server said: gone');
  });

  it('falls back to description, then errorCode, with no registry', () => {
    expect(resolveMessage(error({ description: 'No booking.' }))).toBe('No booking.');
    expect(resolveMessage(error())).toBe('BOOKING_NOT_FOUND');
  });
});

describe('injectErrorMessageResolver', () => {
  it('binds the provided registry', () => {
    TestBed.configureTestingModule({
      providers: [provideSynaxErrorMessages({ codes: { BOOKING_NOT_FOUND: 'Missing booking.' } })],
    });

    const resolve = runInInjectionContext(TestBed.inject(Injector), () =>
      injectErrorMessageResolver(),
    );

    expect(resolve(error())).toBe('Missing booking.');
  });

  it('works without a provided registry', () => {
    TestBed.configureTestingModule({});

    const resolve = runInInjectionContext(TestBed.inject(Injector), () =>
      injectErrorMessageResolver(),
    );

    expect(resolve(error())).toBe('BOOKING_NOT_FOUND');
  });
});
