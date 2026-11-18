import { HttpClient } from '@angular/common/http';
import { Service, inject } from '@angular/core';
import { injectSynaxUrl, toResult } from '@synax/client';
import type { Result } from '@synax/client/core';
import { Observable } from 'rxjs';

import type { UpdateCurrentUserRequest, UserResponse } from './user-profile.api.types';

/**
 * The `errorCode` on the `400` that a bad language code gets.
 *
 * The app sends one of two constants, so this code means a bug on our side. Log it. Do not
 * show it to the person.
 */
export const USER_LANGUAGE_NOT_FOUND = 'USER_LANGUAGE_NOT_FOUND';

/**
 * The caller's own profile.
 *
 * `PATCH /users/me` is a merge patch, so it leaves an absent property alone. That is why
 * {@link updatePreferredLanguage} can send one field instead of reading the profile first.
 */
@Service()
export class UserProfileApi {
  private readonly http = inject(HttpClient);
  private readonly url = injectSynaxUrl();

  /**
   * Stores the language the person chose.
   *
   * Send a language code, `el` or `en`, and not an id, so nothing has to read the language
   * table first. The API resolves the code and copies it to the identity provider, which keeps
   * the `locale` claim of the next sign-in current.
   */
  updatePreferredLanguage(code: string): Observable<UserResponse> {
    const body: UpdateCurrentUserRequest = { preferredLanguageCode: code };
    return this.http.patch<UserResponse>(this.url('users/me'), body);
  }

  /** The caller's own profile. */
  current(): Observable<UserResponse> {
    return this.http.get<UserResponse>(this.url('users/me'));
  }

  /** Stores a phone number, or clears it with `null`. Leaves every other property alone. */
  updatePhoneNumber(phoneNumber: string | null): Observable<UserResponse> {
    const body: UpdateCurrentUserRequest = { phoneNumber };
    return this.http.patch<UserResponse>(this.url('users/me'), body);
  }

  /**
   * Changes what `patch` names and leaves the rest alone. Send only what changed.
   *
   * A refusal arrives as a result, so a form can put it on the field it blames: a bad name is
   * `USER_INVALID_NAME` on `firstName` or `lastName`.
   */
  update(patch: UpdateCurrentUserRequest): Observable<Result<UserResponse>> {
    return this.http
      .patch<UserResponse>(this.url('users/me'), patch)
      .pipe(toResult<UserResponse>());
  }
}

/** The refusals of `PATCH /users/me` that a profile form places on a field. */
export const UserProfileErrorCodes = {
  /** A name is blank, over 64 characters, or has symbols. */
  InvalidName: 'USER_INVALID_NAME',
  InvalidPhone: 'USER_INVALID_PHONE',
} as const;
