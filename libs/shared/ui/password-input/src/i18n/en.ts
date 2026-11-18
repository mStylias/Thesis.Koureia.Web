import type { Translation } from '@jsverse/transloco';

const en: Translation = {
  label: 'Password',
  show: 'Show password',
  clear: 'Clear',
  requirementsIntro: 'Password must include:',
  rules: {
    minLength: 'at least {{min}} characters',
    uppercase: 'an uppercase letter',
    lowercase: 'a lowercase letter',
    digit: 'a number',
    special: 'a special character',
  },
  strength: {
    label: 'Password strength',
    none: 'Enter a password',
    veryWeak: 'Very weak',
    weak: 'Weak',
    fair: 'Fair',
    good: 'Good',
    strong: 'Strong',
  },
  // Sentences the live region joins once typing pauses.
  announce: {
    strength: 'Strength: {{strength}}.',
    progress: '{{met}} of {{total}} requirements met.',
    complete: 'All requirements met.',
    missing: 'Missing: {{rules}}.',
    separator: ', ',
  },
  errors: {
    required: 'Password is required',
    password: {
      minLength: 'Password must be at least {{min}} characters',
      uppercase: 'Password must include an uppercase letter',
      lowercase: 'Password must include a lowercase letter',
      digit: 'Password must include a number',
      special: 'Password must include a special character',
    },
    passwordInvalid: 'Password does not meet the requirements',
  },
};

export default en;
