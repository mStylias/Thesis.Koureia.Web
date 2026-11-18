import type { UpdateCurrentUserRequest, UserResponse } from './user-profile.api.types';
import type { UserProfileFormValue } from './user-profile.rules.types';

/** The longest name the sign-in provider takes. */
export const NAME_MAX_LENGTH = 64;

/**
 * The sign-in provider's person-name rule, which the API applies too. A name it refuses would be
 * saved here and never reach the sign-in pages.
 */
export const NAME_PATTERN = /^[^<>&"\v$%!#?§;*~/\\|^=[\]{}()\p{Cc}]+$/u;

/** The saved profile as a form edits it. */
export function userProfileFormValue(user: UserResponse): UserProfileFormValue {
  return {
    firstName: user.firstName,
    lastName: user.lastName,
    phoneNumber: user.phoneNumber ?? '',
  };
}

/** A merge patch of what changed since `saved`. Empty when nothing did. */
export function profilePatch(
  value: UserProfileFormValue,
  saved: UserProfileFormValue,
): UpdateCurrentUserRequest {
  const firstName = value.firstName.trim();
  const lastName = value.lastName.trim();
  const phoneNumber = value.phoneNumber.trim();

  return {
    ...(firstName === saved.firstName ? {} : { firstName }),
    ...(lastName === saved.lastName ? {} : { lastName }),
    ...(phoneNumber === saved.phoneNumber
      ? {}
      : { phoneNumber: phoneNumber === '' ? null : phoneNumber }),
  };
}
