import type { HttpError } from '@synax/client/core';
import { formErrors } from './form-errors';

const resolveMessage = (error: HttpError): string => `resolved:${error.errorCode}`;

function refusal(overrides: Partial<HttpError> = {}): HttpError {
  return { errorCode: 'VALIDATION_FAILED', httpCode: 400, validationErrors: [], ...overrides };
}

describe('formErrors', () => {
  it('places a validation error on the property it names', () => {
    const errors = formErrors(
      refusal({
        validationErrors: [
          { code: 'REQUIRED', description: 'Name is required.', propertyName: 'name' },
        ],
      }),
      resolveMessage,
    );

    expect(errors).toEqual([{ code: 'REQUIRED', message: 'Name is required.', path: ['name'] }]);
  });

  it('prefers the caller’s copy for a validation error’s own code over the description', () => {
    const errors = formErrors(
      refusal({
        validationErrors: [
          {
            code: 'CUSTOMER_INVALID_NAME',
            description: 'First name is required.',
            propertyName: 'newCustomer.firstName',
          },
          { code: 'OTHER', description: 'Kept as sent.', propertyName: 'email' },
        ],
      }),
      resolveMessage,
      {},
      (code) => (code === 'CUSTOMER_INVALID_NAME' ? 'Απαιτείται όνομα.' : undefined),
    );

    expect(errors).toEqual([
      {
        code: 'CUSTOMER_INVALID_NAME',
        message: 'Απαιτείται όνομα.',
        path: ['newCustomer', 'firstName'],
      },
      { code: 'OTHER', message: 'Kept as sent.', path: ['email'] },
    ]);
  });

  it('keeps an error that names no property for the form itself', () => {
    const errors = formErrors(
      refusal({
        validationErrors: [{ code: 'ESCALATION', description: 'Not yours to grant.' }],
      }),
      resolveMessage,
    );

    expect(errors).toEqual([
      { code: 'ESCALATION', message: 'Not yours to grant.', path: undefined },
    ]);
  });

  it('splits a nested error into the indexed path its member sits at', () => {
    const errors = formErrors(
      refusal({
        validationErrors: [
          {
            code: 'INVALID',
            description: 'Bad item.',
            propertyName: 'items[2]',
            innerErrors: [
              { code: 'REQUIRED', description: 'Item name required.', propertyName: 'name' },
            ],
          },
        ],
      }),
      resolveMessage,
    );

    expect(errors.map((error) => error.path)).toEqual([
      ['items', 2],
      ['items', 2, 'name'],
    ]);
  });

  it('answers for a description the server left empty', () => {
    const errors = formErrors(
      refusal({ validationErrors: [{ code: 'REQUIRED', description: '', propertyName: 'name' }] }),
      resolveMessage,
    );

    expect(errors[0].message).toBe('resolved:VALIDATION_FAILED');
  });

  it('blames the field a mapped error code belongs to', () => {
    const errors = formErrors(refusal({ errorCode: 'ROLE_NAME_TAKEN' }), resolveMessage, {
      ROLE_NAME_TAKEN: 'name',
    });

    expect(errors).toEqual([
      { code: 'ROLE_NAME_TAKEN', message: 'resolved:ROLE_NAME_TAKEN', path: ['name'] },
    ]);
  });

  it('reports a refusal with nothing in it as one general message', () => {
    const errors = formErrors(refusal({ errorCode: 'NETWORK_ERROR', httpCode: 0 }), resolveMessage);

    expect(errors).toEqual([{ code: 'NETWORK_ERROR', message: 'resolved:NETWORK_ERROR' }]);
  });
});
