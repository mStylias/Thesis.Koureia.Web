import {
  clientSideError,
  errorsFor,
  flattenValidationErrors,
  generalErrors,
  parseHttpError,
  SyntheticErrorCodes,
} from './index';

describe('parseHttpError', () => {
  it('maps a Synax problem body field-by-field (title → errorCode)', () => {
    // The shape HttpErrorExtensions.ToProblemResult produces.
    const body = {
      type: 'https://tools.ietf.org/html/rfc9110#section-15.5.5',
      title: 'BOOKING_NOT_FOUND',
      status: 404,
      detail: 'No booking with that id.',
      traceId: '00-abc-def-00',
    };

    const error = parseHttpError(404, body);

    expect(error.errorCode).toBe('BOOKING_NOT_FOUND');
    expect(error.httpCode).toBe(404);
    expect(error.description).toBe('No booking with that id.');
    expect(error.traceId).toBe('00-abc-def-00');
    expect(error.validationErrors).toEqual([]);
    expect(error.raw).toBe(body);
  });

  it('maps the errors extension to validationErrors, nesting included', () => {
    const body = {
      title: 'VALIDATION_FAILED',
      status: 400,
      detail: 'Validation failed.',
      errors: [
        { code: 'REQUIRED', description: 'Name is required.', propertyName: 'name' },
        {
          code: 'INVALID_ITEMS',
          description: 'Items invalid.',
          propertyName: 'items[2]',
          innerErrors: [
            { code: 'REQUIRED', description: 'Item name required.', propertyName: 'name' },
          ],
        },
        { code: 'GENERAL', description: 'Something about the whole request.' },
      ],
    };

    const error = parseHttpError(400, body);

    expect(error.validationErrors).toHaveLength(3);
    expect(error.validationErrors[0]).toEqual({
      code: 'REQUIRED',
      description: 'Name is required.',
      propertyName: 'name',
      innerErrors: undefined,
    });
    expect(error.validationErrors[1].innerErrors).toHaveLength(1);
    expect(error.validationErrors[2].propertyName).toBeUndefined();
  });

  it('parses a problem body delivered as a JSON string', () => {
    const error = parseHttpError(409, JSON.stringify({ title: 'CONFLICT', status: 409 }));
    expect(error.errorCode).toBe('CONFLICT');
  });

  it('falls back to HTTP_{status} for non-problem bodies, preserving raw', () => {
    const error = parseHttpError(502, '<html>Bad Gateway</html>');

    expect(error.errorCode).toBe('HTTP_502');
    expect(error.httpCode).toBe(502);
    expect(error.raw).toBe('<html>Bad Gateway</html>');
  });

  it('falls back to HTTP_{status} for empty bodies', () => {
    const error = parseHttpError(403, null);

    expect(error.errorCode).toBe('HTTP_403');
    expect(error.raw).toBeUndefined();
  });

  it('uses HTTP_{status} when a problem body has no usable title', () => {
    const error = parseHttpError(500, { status: 500, detail: 'boom' });

    expect(error.errorCode).toBe('HTTP_500');
    expect(error.description).toBe('boom');
  });

  it('maps status 0 to NETWORK_ERROR', () => {
    const error = parseHttpError(0, undefined);

    expect(error.errorCode).toBe(SyntheticErrorCodes.NetworkError);
    expect(error.httpCode).toBe(0);
  });
});

describe('validation error helpers', () => {
  const error = parseHttpError(400, {
    title: 'VALIDATION_FAILED',
    status: 400,
    errors: [
      {
        code: 'INVALID_ITEMS',
        description: 'Items invalid.',
        propertyName: 'items[2]',
        innerErrors: [
          { code: 'REQUIRED', description: 'Item name required.', propertyName: 'name' },
        ],
      },
      { code: 'GENERAL', description: 'Whole-request problem.' },
    ],
  });

  it('flattens depth-first, joining inner paths onto the parent', () => {
    const flat = flattenValidationErrors(error);

    expect(flat.map((e) => e.propertyName)).toEqual(['items[2]', 'items[2].name', undefined]);
    expect(flat.map((e) => e.code)).toEqual(['INVALID_ITEMS', 'REQUIRED', 'GENERAL']);
  });

  it('errorsFor filters by full path', () => {
    expect(errorsFor(error, 'items[2].name').map((e) => e.code)).toEqual(['REQUIRED']);
    expect(errorsFor(error, 'missing')).toEqual([]);
  });

  it('generalErrors returns errors that belong to no field', () => {
    expect(generalErrors(error).map((e) => e.code)).toEqual(['GENERAL']);
  });
});

describe('clientSideError', () => {
  it('defaults to httpCode 0 with empty validation errors', () => {
    const error = clientSideError(SyntheticErrorCodes.Timeout, 'timed out');

    expect(error).toEqual({
      errorCode: 'TIMEOUT',
      httpCode: 0,
      description: 'timed out',
      validationErrors: [],
      raw: undefined,
    });
  });
});
