import { HttpClient, HttpParams } from '@angular/common/http';
import { Service, inject } from '@angular/core';
import { injectSynaxUrl, toResult } from '@synax/client';
import type { Result } from '@synax/client/core';
import type { Observable } from 'rxjs';

import type {
  EmailReminderSubscriptionResponse,
  SetEmailRemindersByTokenRequest,
} from './email-reminders.api.types';

/**
 * The reminder emails of the person an unsubscribe link belongs to. No sign-in: the signed token
 * is the authorization, and a walk-in has no account.
 *
 * ```ts
 * import { EmailRemindersApi } from '@api/reminders';
 * ```
 *
 * Each call answers `REMINDERS_INVALID_TOKEN` for a bad or unknown token.
 */
@Service()
export class EmailRemindersApi {
  private readonly http = inject(HttpClient);
  private readonly url = injectSynaxUrl();

  /** Reads the subscription and changes nothing. Mail scanners open links. */
  read(token: string): Observable<Result<EmailReminderSubscriptionResponse>> {
    return this.http
      .get<EmailReminderSubscriptionResponse>(this.url('reminders/unsubscribe'), {
        params: new HttpParams().set('token', token),
      })
      .pipe(toResult<EmailReminderSubscriptionResponse>());
  }

  /** Turns the reminder emails off. */
  unsubscribe(token: string): Observable<Result<EmailReminderSubscriptionResponse>> {
    return this.write('reminders/unsubscribe', token);
  }

  /** Turns the reminder emails on again. */
  resubscribe(token: string): Observable<Result<EmailReminderSubscriptionResponse>> {
    return this.write('reminders/resubscribe', token);
  }

  private write(
    path: string,
    token: string,
  ): Observable<Result<EmailReminderSubscriptionResponse>> {
    const body: SetEmailRemindersByTokenRequest = { token };
    return this.http
      .post<EmailReminderSubscriptionResponse>(this.url(path), body)
      .pipe(toResult<EmailReminderSubscriptionResponse>());
  }
}

/** The `errorCode` of a bad or unknown unsubscribe token. */
export const REMINDERS_INVALID_TOKEN = 'REMINDERS_INVALID_TOKEN';
