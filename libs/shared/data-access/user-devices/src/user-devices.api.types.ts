/** The response of `GET /reminders/push/public-key`. */
export interface PushPublicKeyResponse {
  /** The VAPID public key, base64url, as `PushManager.subscribe` takes it. */
  readonly publicKey: string;
}

/** The keys of a browser subscription, base64url, from `PushSubscription.toJSON().keys`. */
export interface PushSubscriptionKeysAddDto {
  readonly p256dh: string;
  readonly auth: string;
}

/** The body of `PUT /users/me/push-devices`. Safe to repeat. */
export interface RegisterPushDeviceRequest {
  /** HTTPS. */
  readonly endpoint: string;
  readonly keys: PushSubscriptionKeysAddDto;
  /** At most 200 characters, for example `Chrome · Android`. */
  readonly label?: string | null;
  readonly platform: 'web';
}

/** A registered browser. The endpoint and the keys never leave the API. */
export interface PushDeviceResponse {
  readonly id: string;
  readonly label: string | null;
  readonly platform: string;
  readonly lastSeenAt: string;
}

/** The body of `POST /users/me/push-devices/unregister`. */
export interface UnregisterPushDeviceRequest {
  readonly endpoint: string;
}

/** The body of `POST /users/me/push-devices/test`. */
export interface SendTestPushRequest {
  readonly endpoint: string;
}
