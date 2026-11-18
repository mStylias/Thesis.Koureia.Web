import type { Translation } from '@jsverse/transloco';

const en: Translation = {
  label: 'Phone number',
  errors: {
    required: 'A phone number is required',
    phoneTooShort: 'This number is too short',
    phoneTooLong: 'This number is too long',
    phoneInvalidCountry: 'Invalid country code',
    phoneInvalidType: 'This type of number is not accepted',
    phoneGreekMobile: 'Enter a valid Greek mobile number (starting with 69)',
    phoneInvalid: 'Invalid phone number',
  },
};

export default en;
