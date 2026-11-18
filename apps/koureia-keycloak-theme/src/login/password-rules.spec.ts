import '@angular/compiler';
import { describe, expect, it } from 'vitest';
import { REQUIRED_POLICY, createPasswordRules } from './password-rules';

describe('REQUIRED_POLICY', () => {
  /*
   * A pin, not a behavior test. The constant is a hand-copy of the `koureia` realm policy in
   * `Aptison.Booking`, which no test here can read, and it gates the submit.
   *
   * CAUTION: A failure here means the realm and the theme moved apart. Reconcile them. Do not
   * update the expectation alone.
   */
  it('matches the koureia realm: length 6, one upper-case letter, one digit', () => {
    expect(REQUIRED_POLICY).toEqual({ length: 6, upperCase: 1, digits: 1 });
  });
});

describe('createPasswordRules', () => {
  it('uses the policy when Keycloak supplies it', () => {
    const rules = createPasswordRules({
      length: 8,
      lowerCase: 1,
      specialChars: 1,
    });

    expect(rules.map((rule) => rule.key)).toEqual(['minLength', 'lowercase', 'special']);
    expect(rules.at(0)?.params).toEqual({ min: 8 });
  });

  it('falls back to six characters, one uppercase letter, and one digit', () => {
    const rules = createPasswordRules(undefined);

    expect(rules.map((rule) => rule.key)).toEqual(['minLength', 'uppercase', 'digit']);
    expect(rules.every((rule) => rule.test('Abcde1'))).toBe(true);
    expect(rules.every((rule) => rule.test('abcdef'))).toBe(false);
  });
});
