interface UsernameRealm {
  loginWithEmailAllowed: boolean;
  registrationEmailAsUsername: boolean;
}

export type UsernameLabelKey = 'email' | 'username' | 'usernameOrEmail';
export type PasswordResetInstructionKey = 'emailInstruction' | 'emailInstructionUsername';

export function usernameLabelKey(realm: UsernameRealm): UsernameLabelKey {
  if (!realm.loginWithEmailAllowed) {
    return 'username';
  }

  return realm.registrationEmailAsUsername ? 'email' : 'usernameOrEmail';
}

interface InstructionRealm extends UsernameRealm {
  duplicateEmailsAllowed: boolean;
}

/**
 * Which sentence goes above the field. `emailInstruction` offers a username or an email address.
 * `emailInstructionUsername` offers a username only.
 *
 * Keycloak keys this on `duplicateEmailsAllowed` alone, which contradicts its own label: with
 * `loginWithEmailAllowed` off, the field reads "Username" and the sentence still offers an email
 * address the realm rejects. This follows {@link usernameLabelKey} instead.
 */
export function passwordResetInstructionKey(realm: InstructionRealm): PasswordResetInstructionKey {
  if (!realm.loginWithEmailAllowed) return 'emailInstructionUsername';

  return realm.duplicateEmailsAllowed ? 'emailInstructionUsername' : 'emailInstruction';
}
