import { NAME_PATTERN, profilePatch, userProfileFormValue } from './user-profile.rules';

const saved = { firstName: 'Nikos', lastName: 'Papas', phoneNumber: '+306912345678' };

describe('profilePatch', () => {
  it('sends nothing when nothing changed', () => {
    expect(profilePatch({ ...saved, firstName: ' Nikos ' }, saved)).toEqual({});
  });

  it('sends only the trimmed fields that changed', () => {
    expect(profilePatch({ ...saved, lastName: ' Papadopoulos ' }, saved)).toEqual({
      lastName: 'Papadopoulos',
    });
  });

  it('clears the phone with null', () => {
    expect(profilePatch({ ...saved, phoneNumber: '' }, saved)).toEqual({ phoneNumber: null });
  });
});

describe('userProfileFormValue', () => {
  it('reads a missing phone as empty', () => {
    expect(
      userProfileFormValue({
        id: 'u',
        keycloakId: null,
        firstName: 'Nikos',
        lastName: 'Papas',
        email: 'n@example.com',
        phoneNumber: null,
        language: { id: 'l', code: 'el', name: 'Ελληνικά' },
        emailRemindersEnabled: true,
      }),
    ).toEqual({ firstName: 'Nikos', lastName: 'Papas', phoneNumber: '' });
  });
});

describe('NAME_PATTERN', () => {
  it('takes Greek and Latin names', () => {
    expect(NAME_PATTERN.test('Θανάσης')).toBe(true);
    expect(NAME_PATTERN.test("O'Brien-Smith")).toBe(true);
  });

  it('refuses the symbols the sign-in provider refuses', () => {
    expect(NAME_PATTERN.test('<script>')).toBe(false);
    expect(NAME_PATTERN.test('Nikos & co')).toBe(false);
  });
});
