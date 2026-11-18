import { NAME_MAX_LENGTH, NAME_PATTERN, type UserProfileFormValue } from '@api/users';
import { field, fields } from '@util/forms';

const K = 'account.profile';

export const PROFILE_FIELDS = fields<UserProfileFormValue>({
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
  phoneNumber: field({ label: `${K}.phone`, hint: `${K}.phoneHint` }),
});
