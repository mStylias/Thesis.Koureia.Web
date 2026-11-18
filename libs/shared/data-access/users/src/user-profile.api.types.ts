/** The language on a profile. Identify it by code, never by id. See `UserProfileApi`. */
export interface LanguageViewDto {
  readonly id: string;
  readonly code: string;
  readonly name: string;
}

/** The response of `PATCH /users/me`: the profile after the patch. */
export interface UserResponse {
  readonly id: string;
  readonly keycloakId: string | null;
  readonly firstName: string;
  readonly lastName: string;
  readonly email: string;
  readonly phoneNumber: string | null;
  readonly language: LanguageViewDto;
  /** Reminder emails the day before and 2 hours before each appointment. */
  readonly emailRemindersEnabled: boolean;
}

/** The body of `PATCH /users/me`. A merge patch: an omitted property is left alone. */
export interface UpdateCurrentUserRequest {
  readonly firstName?: string;
  readonly lastName?: string;
  readonly phoneNumber?: string | null;
  readonly preferredLanguageCode?: string;
  readonly emailRemindersEnabled?: boolean;
}
