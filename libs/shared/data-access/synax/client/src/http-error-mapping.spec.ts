import { HttpErrorResponse } from '@angular/common/http';
import { SyntheticErrorCodes } from '@synax/client/core';
import { asHttpError, tryAsHttpError } from './index';

const problem = new HttpErrorResponse({
  status: 404,
  statusText: 'Not Found',
  error: { title: 'BOOKING_NOT_FOUND', status: 404, detail: 'No booking with that id.' },
});

describe('tryAsHttpError', () => {
  it('maps a problem response to its error code', () => {
    expect(tryAsHttpError(problem)?.errorCode).toBe('BOOKING_NOT_FOUND');
  });

  it('unwraps a wrapped failure through cause', () => {
    // The shape a rethrow wrapper produces, such as Angular's ResourceWrappedError.
    const wrapped = new Error('Resource returned an error', { cause: problem });

    expect(tryAsHttpError(wrapped)?.errorCode).toBe('BOOKING_NOT_FOUND');
  });

  it('gives up on a cause chain that holds no HTTP failure', () => {
    expect(tryAsHttpError(new Error('outer', { cause: new Error('inner') }))).toBeNull();
  });

  it('survives a self-referencing cause', () => {
    const cyclic: Error & { cause?: unknown } = new Error('cyclic');
    cyclic.cause = cyclic;

    expect(tryAsHttpError(cyclic)).toBeNull();
  });
});

describe('asHttpError', () => {
  it('classifies an unclassifiable error as UNKNOWN_ERROR', () => {
    expect(asHttpError(new Error('a bug'))?.errorCode).toBe(SyntheticErrorCodes.Unknown);
  });

  it('returns null when there is no error', () => {
    expect(asHttpError(null)).toBeNull();
    expect(asHttpError(undefined)).toBeNull();
  });

  it('still finds the problem body inside a wrapper', () => {
    expect(asHttpError(new Error('wrapped', { cause: problem }))?.httpCode).toBe(404);
  });
});
