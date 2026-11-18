import { describe, expect, it } from 'vitest';
import {
  groupProfileFields,
  isHiddenField,
  maxLengthOf,
  shouldShowGlobalMessage,
  shouldShowProfileErrors,
} from './user-profile-fields.logic';

describe('hidden fields', () => {
  it('hides what the profile marks hidden, and the redundant password confirmation', () => {
    expect(isHiddenField({ name: 'username', annotations: { inputType: 'hidden' } })).toBe(true);
    expect(isHiddenField({ name: 'password-confirm', annotations: {} })).toBe(true);
  });

  it('shows an ordinary field', () => {
    expect(isHiddenField({ name: 'email', annotations: { inputType: 'email' } })).toBe(false);
    expect(isHiddenField({ name: 'firstName', annotations: {} })).toBe(false);
  });
});

const field = (name: string) => ({ attribute: { name } });
const visible = () => false;
const names = (fields: readonly { attribute: { name: string } }[]) =>
  fields.map((entry) => entry.attribute.name);

describe('user profile field groups', () => {
  it('lifts the name fields out of the user profile order', () => {
    const groups = groupProfileFields(
      [field('email'), field('lastName'), field('firstName'), field('password')],
      visible,
    );

    expect(names(groups.nameFields)).toEqual(['firstName', 'lastName']);
    expect(names(groups.otherFields)).toEqual(['email', 'password']);
  });

  it('keeps a hidden name field in the form but out of the row', () => {
    const groups = groupProfileFields(
      [field('firstName'), field('lastName'), field('email')],
      (entry) => entry.attribute.name === 'firstName',
    );

    expect(names(groups.nameFields)).toEqual(['lastName']);
    expect(names(groups.otherFields)).toEqual(['firstName', 'email']);
  });

  it('leaves the row empty when the profile declares no name fields', () => {
    const groups = groupProfileFields([field('email'), field('password')], visible);

    expect(groups.nameFields).toEqual([]);
    expect(names(groups.otherFields)).toEqual(['email', 'password']);
  });
});

describe('field maxlength', () => {
  it('reads the length validator, which Keycloak sends as a string', () => {
    expect(maxLengthOf({ annotations: {}, validators: { length: { max: '64' } } })).toBe(64);
    expect(maxLengthOf({ annotations: {}, validators: { length: { max: 64 } } })).toBe(64);
  });

  it('prefers the input annotation over the storage limit', () => {
    expect(
      maxLengthOf({ annotations: { inputTypeMaxlength: 40 }, validators: { length: { max: 64 } } }),
    ).toBe(40);
  });

  it('sets no attribute when the profile constrains nothing', () => {
    expect(maxLengthOf({ annotations: {}, validators: {} })).toBeNull();
    expect(maxLengthOf({ annotations: {}, validators: { length: {} } })).toBeNull();
  });

  it('ignores a value that is not a usable length', () => {
    expect(maxLengthOf({ annotations: {}, validators: { length: { max: 'none' } } })).toBeNull();
    expect(maxLengthOf({ annotations: {}, validators: { length: { max: 0 } } })).toBeNull();
    expect(maxLengthOf({ annotations: {}, validators: { length: { max: -1 } } })).toBeNull();
  });
});

const errorsOn = (...fields: string[]) => ({ existsError: (f: string) => fields.includes(f) });

describe('the message above the form', () => {
  it('is hidden when a visible field already reports the error', () => {
    // A taken address, which Keycloak reports as "Email already exists. Username already exists."
    expect(shouldShowGlobalMessage(['email', 'termsAccepted'], errorsOn('email', 'username'))).toBe(
      false,
    );
  });

  it('is hidden when several fields each report their own error', () => {
    expect(
      shouldShowGlobalMessage(
        ['firstName', 'lastName', 'email'],
        errorsOn('firstName', 'lastName'),
      ),
    ).toBe(false);
  });

  it('is shown when the error belongs to no field', () => {
    expect(shouldShowGlobalMessage(['email', 'termsAccepted'], errorsOn())).toBe(true);
  });

  it('is shown when only a hidden field reports the error, which nothing else would surface', () => {
    expect(shouldShowGlobalMessage(['email'], errorsOn('username'))).toBe(true);
  });

  it('counts the terms checkbox, which the register page renders itself', () => {
    expect(shouldShowGlobalMessage(['email', 'termsAccepted'], errorsOn('termsAccepted'))).toBe(
      false,
    );
  });
});

describe('when the profile fields may show their errors', () => {
  it('hides local validation errors until the first submit attempt', () => {
    const fields = [{ displayableErrors: [{ source: { type: 'validator' } }] }];

    expect(
      shouldShowProfileErrors({ submitAttempted: false, fields, hasOtherServerError: false }),
    ).toBe(false);
    expect(
      shouldShowProfileErrors({ submitAttempted: true, fields, hasOtherServerError: false }),
    ).toBe(true);
  });

  it('shows errors the server returned when the page reloaded', () => {
    expect(
      shouldShowProfileErrors({
        submitAttempted: false,
        fields: [{ displayableErrors: [{ source: { type: 'server' } }] }],
        hasOtherServerError: false,
      }),
    ).toBe(true);
  });

  it('shows them for a server error carried by no profile field', () => {
    expect(
      shouldShowProfileErrors({ submitAttempted: false, fields: [], hasOtherServerError: true }),
    ).toBe(true);
  });
});
