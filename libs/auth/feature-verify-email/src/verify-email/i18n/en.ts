import type { Translation } from '@jsverse/transloco';

const en: Translation = {
  title: 'Confirm your email address',
  lead: 'We sent a code to {{email}}. Enter it below to finish setting up your account.',
  codeLabel: 'Verification code',
  verify: 'Confirm',
  verifying: 'Confirming…',
  expiresIn: 'This code expires in {{time}}.',
  resend: 'Send a new code',
  resendIn: 'Send a new code in {{seconds}}s',
  errors: {
    codeIncorrect: 'That code is not correct. You have {{count}} tries left.',
    codeIncorrectPlain: 'That code is not correct.',
    attemptsExhausted: 'Too many incorrect tries. Ask for a new code to carry on.',
    noCodePending: 'That code expired or was already used. Ask for a new one.',
    // Deliberately not "try again": no realm without an email claim fixes itself.
    emailMissing: 'Your account has no email address on it. Please contact us so we can fix it.',
    dailyLimitReached: 'We have sent too many codes to this address today. Try again later.',
    sendFailed: 'We could not send the code. Try again in a moment.',
    verifyFailed: 'We could not check the code. Try again in a moment.',
  },
};

export default en;
