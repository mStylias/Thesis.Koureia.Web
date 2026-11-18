import { HttpClient } from '@angular/common/http';
import { Service, inject } from '@angular/core';
import { injectSynaxUrl, toResult } from '@synax/client';
import type { Result } from '@synax/client/core';
import type { Observable } from 'rxjs';

import type {
  PushDeviceResponse,
  PushPublicKeyResponse,
  RegisterPushDeviceRequest,
  SendTestPushRequest,
  UnregisterPushDeviceRequest,
} from './user-devices.api.types';

/**
 * The browsers that receive the caller's reminder pushes, and the key a browser subscribes with.
 *
 * ```ts
 * import { UserDevicesApi } from '@api/user-devices';
 * ```
 *
 * A browser is known by its push endpoint. The `/users/me` routes need a signed-in person with a
 * verified email.
 */
@Service()
export class UserDevicesApi {
  private readonly http = inject(HttpClient);
  private readonly url = injectSynaxUrl();

  /** The VAPID public key. `REMINDERS_PUSH_NOT_CONFIGURED` when the environment has none. */
  publicKey(): Observable<Result<PushPublicKeyResponse>> {
    return this.http
      .get<PushPublicKeyResponse>(this.url('reminders/push/public-key'))
      .pipe(toResult<PushPublicKeyResponse>());
  }

  /**
   * Registers this browser for the caller. Safe to repeat: it refreshes the keys and the last-seen
   * time, and a browser registered to another account moves to the caller.
   */
  register(body: RegisterPushDeviceRequest): Observable<Result<PushDeviceResponse>> {
    return this.http
      .put<PushDeviceResponse>(this.url('users/me/push-devices'), body)
      .pipe(toResult<PushDeviceResponse>());
  }

  /** Removes this browser. A browser the API does not know is already off, so it never refuses. */
  unregister(endpoint: string): Observable<Result<null>> {
    const body: UnregisterPushDeviceRequest = { endpoint };
    return this.http
      .post<null>(this.url('users/me/push-devices/unregister'), body)
      .pipe(toResult<null>());
  }

  /** Sends a test push to this browser. At most 5 per customer per hour. */
  sendTest(endpoint: string): Observable<Result<null>> {
    const body: SendTestPushRequest = { endpoint };
    return this.http
      .post<null>(this.url('users/me/push-devices/test'), body)
      .pipe(toResult<null>());
  }
}

/** The `errorCode` values the push routes answer with. */
export const UserDeviceErrorCodes = {
  /** The environment has no push keys. Push is off on every platform. */
  PushNotConfigured: 'REMINDERS_PUSH_NOT_CONFIGURED',
  InvalidSubscription: 'REMINDERS_INVALID_SUBSCRIPTION',
  /** Another tab registered the same browser at the same moment. A retry succeeds. */
  RegisterConflict: 'REMINDERS_DEVICE_REGISTER_CONFLICT',
  /** This browser is not registered to the caller. */
  DeviceNotFound: 'REMINDERS_DEVICE_NOT_FOUND',
  /** The push service says the subscription is gone. The API already removed the device. */
  SubscriptionGone: 'REMINDERS_SUBSCRIPTION_GONE',
  /** The test limit. The response carries `Retry-After`. */
  TestRateLimited: 'REMINDERS_TEST_PUSH_RATE_LIMITED',
  DeliveryFailed: 'REMINDERS_PUSH_DELIVERY_FAILED',
} as const;
