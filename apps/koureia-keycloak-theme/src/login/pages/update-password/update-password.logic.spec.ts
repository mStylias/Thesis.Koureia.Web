import '@angular/compiler';
import { describe, expect, it } from 'vitest';
import { passwordRules } from '@ui/password-input';
import { PASSWORD_ERROR_FIELDS, canCancel, meetsPasswordRules } from './update-password.logic';

describe('canCancel', () => {
  it('offers a way back only for an action the account console started', () => {
    expect(canCancel(true)).toBe(true);
  });

  it('offers none when the page was reached from a reset link', () => {
    // Keycloak omits the flag entirely on that path rather than sending `false`.
    expect(canCancel(undefined)).toBe(false);
    expect(canCancel(false)).toBe(false);
  });
});

describe('PASSWORD_ERROR_FIELDS', () => {
  it('covers both names Keycloak attributes a rejected password to', () => {
    expect(PASSWORD_ERROR_FIELDS).toEqual(['password', 'password-confirm']);
  });
});

describe('meetsPasswordRules', () => {
  const rules = passwordRules({
    minLength: 6,
    uppercase: true,
    lowercase: false,
    digit: true,
    special: false,
  });

  it('accepts a password only when every displayed requirement passes', () => {
    expect(meetsPasswordRules('Abcde1', rules)).toBe(true);
    expect(meetsPasswordRules('abcdef', rules)).toBe(false);
    expect(meetsPasswordRules('ABCDE1', rules)).toBe(true);
  });
});
