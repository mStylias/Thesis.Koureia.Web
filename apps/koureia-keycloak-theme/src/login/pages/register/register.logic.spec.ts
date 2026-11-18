import { describe, expect, it } from 'vitest';
import { canSubmitRegistration } from './register.logic';

describe('registration flow', () => {
  it('requires a valid profile and accepted terms', () => {
    expect(canSubmitRegistration(true, true)).toBe(true);
    expect(canSubmitRegistration(true, false)).toBe(false);
    expect(canSubmitRegistration(false, true)).toBe(false);
  });
});
