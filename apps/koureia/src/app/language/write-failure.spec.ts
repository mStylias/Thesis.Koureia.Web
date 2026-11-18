import { describe, expect, it } from 'vitest';
import { isRetryableWriteFailure } from './write-failure';

describe('retrying a failed profile write', () => {
  it('retries when no response arrived — the CORS and offline case', () => {
    expect(isRetryableWriteFailure({ httpCode: 0, errorCode: 'HTTP_0' })).toBe(true);
  });

  it('retries a server fault', () => {
    expect(isRetryableWriteFailure({ httpCode: 500 })).toBe(true);
    expect(isRetryableWriteFailure({ httpCode: 503 })).toBe(true);
  });

  it('gives up on a request the server refused, which a repeat cannot fix', () => {
    expect(isRetryableWriteFailure({ httpCode: 400 })).toBe(false);
    expect(isRetryableWriteFailure({ httpCode: 401 })).toBe(false);
    expect(isRetryableWriteFailure({ httpCode: 404 })).toBe(false);
  });

  it('gives up on anything that is not an API failure at all', () => {
    expect(isRetryableWriteFailure(new TypeError('undefined is not a function'))).toBe(false);
    expect(isRetryableWriteFailure(null)).toBe(false);
    expect(isRetryableWriteFailure(undefined)).toBe(false);
    expect(isRetryableWriteFailure({ httpCode: '500' })).toBe(false);
  });
});
