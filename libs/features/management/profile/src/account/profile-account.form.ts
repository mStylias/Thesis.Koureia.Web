import { NAME_MAX_LENGTH, NAME_PATTERN, type UserProfileFormValue } from '@api/users';
import { formatPhone } from '@ui/phone-input';
import { field, fields } from '@util/forms';

const K = 'managementProfile.profile';

/** The API's name rules, with this page's copy. */
export const PROFILE_ACCOUNT_FIELDS = fields<UserProfileFormValue>({
  firstName: field({
    label: `${K}.firstName`,
    required: `${K}.errors.firstNameRequired`,
    maxLength: NAME_MAX_LENGTH,
    pattern: [NAME_PATTERN, `${K}.errors.nameSymbols`],
  }),
  lastName: field({
    label: `${K}.lastName`,
    required: `${K}.errors.lastNameRequired`,
    maxLength: NAME_MAX_LENGTH,
    pattern: [NAME_PATTERN, `${K}.errors.nameSymbols`],
  }),
  // View mode groups a Greek number, as the Staff page does.
  phoneNumber: field({ label: `${K}.phone`, view: formatPhone }),
});
