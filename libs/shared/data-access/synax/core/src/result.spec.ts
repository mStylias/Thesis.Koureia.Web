import { HttpError, Result } from './index';

describe('Result', () => {
  it('Ok carries data with .NET-shaped members', () => {
    const result: Result<number> = Result.Ok(42);

    expect(result.isSuccess).toBe(true);
    expect(result.isFailure).toBe(false);
    expect(result.data).toBe(42);
    expect(result.error).toBeNull();
  });

  it('Ok with no argument is a void success (the 204 case)', () => {
    const result = Result.Ok();

    expect(result.isSuccess).toBe(true);
    expect(result.data).toBeNull();
  });

  it('Fail carries the typed error', () => {
    const error: HttpError = { errorCode: 'NOT_FOUND', httpCode: 404, validationErrors: [] };
    const result: Result<number> = Result.Fail(error);

    expect(result.isSuccess).toBe(false);
    expect(result.isFailure).toBe(true);
    expect(result.data).toBeNull();
    if (result.isFailure) {
      expect(result.error.errorCode).toBe('NOT_FOUND');
    }
  });

  it('narrows via the isSuccess discriminant like a .NET handler', () => {
    const result: Result<string> = Result.Ok('hello');

    if (result.isSuccess) {
      expect(result.data).toBe('hello');
    } else {
      throw new Error('expected success');
    }
  });

  it('hasData distinguishes 200-with-body from 204', () => {
    expect(Result.hasData(Result.Ok('x'))).toBe(true);
    expect(Result.hasData(Result.Ok<string>())).toBe(false);
    expect(
      Result.hasData(Result.Fail({ errorCode: 'X', httpCode: 400, validationErrors: [] })),
    ).toBe(false);
  });

  it('match handles both branches', () => {
    const ok = Result.match(Result.Ok(2), { ok: (d) => (d ?? 0) * 10, fail: () => -1 });
    const fail = Result.match(
      Result.Fail<HttpError>({ errorCode: 'X', httpCode: 400, validationErrors: [] }),
      {
        ok: () => -1,
        fail: (e) => e.httpCode,
      },
    );

    expect(ok).toBe(20);
    expect(fail).toBe(400);
  });

  it('map transforms success data and passes failures through', () => {
    const mapped = Result.map(Result.Ok(3), (n) => n.toString());
    expect(mapped.isSuccess && mapped.data).toBe('3');

    const voidMapped = Result.map(Result.Ok<number>(), (n) => n.toString());
    expect(voidMapped.isSuccess && voidMapped.data).toBeNull();

    const error: HttpError = { errorCode: 'X', httpCode: 400, validationErrors: [] };
    // A bare `Fail` gives inference nothing to pin the success type to, so `map` gets
    // explicit type arguments.
    const failure: Result<number> = Result.Fail<HttpError>(error);
    const failed = Result.map<number, HttpError, string>(failure, (n) => n.toString());
    expect(failed.isFailure && failed.error).toBe(error);
  });
});
