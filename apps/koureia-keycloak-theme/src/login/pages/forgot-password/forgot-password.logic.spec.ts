import { describe, expect, it } from 'vitest';
import { passwordResetInstructionKey, usernameLabelKey } from './forgot-password.logic';

describe('forgot-password copy', () => {
  it('uses a username label when the realm does not accept email addresses', () => {
    expect(
      usernameLabelKey({
        loginWithEmailAllowed: false,
        registrationEmailAsUsername: false,
      }),
    ).toBe('username');
  });

  it('uses an email label when email is the username', () => {
    expect(
      usernameLabelKey({
        loginWithEmailAllowed: true,
        registrationEmailAsUsername: true,
      }),
    ).toBe('email');
  });

  it('uses a combined label when the realm accepts a username or email address', () => {
    expect(
      usernameLabelKey({
        loginWithEmailAllowed: true,
        registrationEmailAsUsername: false,
      }),
    ).toBe('usernameOrEmail');
  });

  it('does not imply that an email address identifies one account when duplicates are allowed', () => {
    expect(
      passwordResetInstructionKey({
        loginWithEmailAllowed: true,
        registrationEmailAsUsername: false,
        duplicateEmailsAllowed: true,
      }),
    ).toBe('emailInstructionUsername');
    expect(
      passwordResetInstructionKey({
        loginWithEmailAllowed: true,
        registrationEmailAsUsername: false,
        duplicateEmailsAllowed: false,
      }),
    ).toBe('emailInstruction');
  });

  it('does not offer an email address the realm will not take, whatever Keycloak does', () => {
    // Keycloak keys this on `duplicateEmailsAllowed` alone, which labels the field "Username"
    // above a sentence that asks for a username or an email address.
    for (const duplicateEmailsAllowed of [true, false]) {
      const realm = {
        loginWithEmailAllowed: false,
        registrationEmailAsUsername: false,
        duplicateEmailsAllowed,
      };

      expect(usernameLabelKey(realm)).toBe('username');
      expect(passwordResetInstructionKey(realm)).toBe('emailInstructionUsername');
    }
  });
});
