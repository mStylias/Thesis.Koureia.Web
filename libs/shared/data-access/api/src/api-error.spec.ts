import { HttpErrorResponse } from '@angular/common/http';
import { tryAsHttpError } from '@synax/client';
import { HttpError } from '@synax/client/core';
import { describe, expect, it } from 'vitest';

import { ApiError } from './api-error';

const problem: HttpError = {
  errorCode: 'AUTH_PERMISSION_DENIED',
  httpCode: 403,
  description: 'You cannot read users.',
  validationErrors: [],
};

describe('ApiError', () => {
  it('is throwable and catchable as an Error', () => {
    const error = new ApiError(problem);
    expect(error).toBeInstanceOf(Error);
    expect(error.name).toBe('ApiError');
    expect(() => {
      throw error;
    }).toThrow('You cannot read users.');
  });

  it('carries the whole HttpError contract', () => {
    expect(new ApiError(problem)).toMatchObject(problem);
  });

  it('stays classifiable through its cause, which is what keeps toResult working', () => {
    const response = new HttpErrorResponse({
      status: 403,
      error: { title: 'AUTH_PERMISSION_DENIED', status: 403, detail: 'You cannot read users.' },
    });

    // `tryAsHttpError` matches only `HttpErrorResponse`, `TimeoutError` and `AbortError`, so
    // it finds the body by walking `cause`. This test fails first if the cause is dropped.
    expect(tryAsHttpError(new ApiError(problem, response))).toMatchObject({
      errorCode: 'AUTH_PERMISSION_DENIED',
      httpCode: 403,
    });
    expect(tryAsHttpError(new ApiError(problem))).toBeNull();
  });

  describe('message', () => {
    it("prefers the server's own sentence", () => {
      expect(new ApiError(problem).message).toBe('You cannot read users.');
    });

    it('does not say `HTTP_401 (HTTP 401)`', () => {
      // The 401 with no body, the most common failure the app sees.
      const error = new ApiError({ errorCode: 'HTTP_401', httpCode: 401, validationErrors: [] });
      expect(error.message).toBe('HTTP_401');
    });

    it('omits a meaningless status for a client-side failure', () => {
      const error = new ApiError({ errorCode: 'NETWORK_ERROR', httpCode: 0, validationErrors: [] });
      expect(error.message).toBe('NETWORK_ERROR');
    });

    it('pairs a described code with its status when both say something', () => {
      const error = new ApiError({
        errorCode: 'USER_EMAIL_CONFLICT',
        httpCode: 409,
        validationErrors: [],
      });
      expect(error.message).toBe('USER_EMAIL_CONFLICT (HTTP 409)');
    });
  });
});
