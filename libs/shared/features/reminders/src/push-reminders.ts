import {
  Injector,
  Service,
  computed,
  effect,
  inject,
  isDevMode,
  signal,
  untracked,
} from '@angular/core';
import { UserDeviceErrorCodes, UserDevicesApi } from '@api/user-devices';
import { firstValueFrom } from 'rxjs';

import { decodeBase64Url, sameKey } from './core/base64url';
import { deviceLabel, environmentState } from './core/push-environment';
import type { PushEnvironment } from './core/push-environment.types';
import { derivePushState } from './core/push-state';
import type { PushServer } from './core/push-state.types';
import { PushBrowser } from './push-browser';
import type { PushEnableOutcome, PushTestOutcome } from './push-reminders.types';
import { REMINDERS_ACCOUNT } from './reminders-account';

/**
 * Push reminders on this browser.
 *
 * ```ts
 * import { PushReminders } from '@features/reminders';
 * ```
 *
 * The browser subscription is the truth: push is on for this browser if and only if a
 * subscription exists. Nothing else stores the choice.
 *
 * Browser only. On the server {@link state} stays `unknown`, and nothing renders.
 */
@Service()
export class PushReminders {
  private readonly browser = inject(PushBrowser);
  private readonly api = inject(UserDevicesApi);
  private readonly account = inject(REMINDERS_ACCOUNT, { optional: true });
  private readonly injector = inject(Injector);

  private readonly environment = signal<PushEnvironment | null>(null);
  private readonly server = signal<PushServer>('unknown');
  private readonly permission = signal<NotificationPermission | null>(null);
  /** `undefined` until read. */
  private readonly subscription = signal<PushSubscription | null | undefined>(undefined);

  private checking: Promise<void> | null = null;
  private publicKey: Promise<string | null> | null = null;
  private started = false;

  /** The push state of this browser. See `PushState`. */
  readonly state = computed(() => {
    const subscription = this.subscription();
    return derivePushState({
      environment: this.environment(),
      server: this.server(),
      permission: this.permission(),
      subscribed: subscription === undefined ? null : subscription !== null,
    });
  });

  /** The device and browser family, for the guide. `null` until {@link check} runs. */
  readonly platform = computed(() => {
    const environment = this.environment();
    return environment === null
      ? null
      : { os: environment.os, browser: environment.browser, standalone: environment.standalone };
  });

  /**
   * Reads the state of this browser. Each screen that shows push calls it. The first call does
   * the work, and the rest wait for it.
   */
  check(): Promise<void> {
    this.checking ??= this.read();
    return this.checking;
  }

  /**
   * Turns push on. **Must run inside the click handler**: the browser asks only after a user
   * gesture, so the question comes first, before anything is awaited.
   */
  async enable(): Promise<PushEnableOutcome> {
    const environment = this.environment() ?? this.browser.environment();
    if (environment === null || environmentState(environment) !== 'push') return 'unsupported';

    const current = this.browser.permission();
    const permission = current === 'default' ? await this.browser.requestPermission() : current;
    this.permission.set(permission);
    if (permission === 'denied') return 'blocked';
    if (permission !== 'granted') return 'dismissed';

    let subscription: PushSubscription | null = null;
    try {
      const key = await this.loadPublicKey();
      if (key === null) return 'failed';

      const registration = await this.browser.registerWorker();
      subscription = await this.subscribe(registration, key);
      if (await this.registerDevice(subscription, environment)) {
        this.subscription.set(subscription);
        return 'on';
      }
    } catch (error) {
      if (isDevMode()) console.error('[reminders] could not turn push on', error);
    }

    // The browser and the API must agree. A subscription the API does not know is removed.
    await subscription?.unsubscribe().catch(() => false);
    this.subscription.set(null);
    return 'failed';
  }

  /**
   * Turns push off on this browser. Never fails: a browser subscription that is gone stops the
   * pushes even when the API call does not get through, because the API removes a device whose
   * push service answers that the subscription is gone.
   */
  async disable(): Promise<void> {
    const subscription = this.subscription() ?? (await this.readSubscription());
    if (subscription !== null) {
      await Promise.allSettled([
        firstValueFrom(this.api.unregister(subscription.endpoint)),
        subscription.unsubscribe(),
      ]);
    }
    this.subscription.set(null);
  }

  /** Asks the API to send a test push to this browser. */
  async sendTest(): Promise<PushTestOutcome> {
    const subscription = this.subscription() ?? (await this.readSubscription());
    if (subscription === null) {
      this.subscription.set(null);
      return 'gone';
    }

    let result = await firstValueFrom(this.api.sendTest(subscription.endpoint));
    if (!result.isSuccess && result.error.errorCode === UserDeviceErrorCodes.DeviceNotFound) {
      const environment = this.environment() ?? this.browser.environment();
      if (environment !== null && (await this.registerDevice(subscription, environment))) {
        result = await firstValueFrom(this.api.sendTest(subscription.endpoint));
      }
    }
    if (result.isSuccess) return 'sent';

    switch (result.error.errorCode) {
      case UserDeviceErrorCodes.SubscriptionGone:
        // The API already removed the device. Remove the browser half too.
        await subscription.unsubscribe().catch(() => false);
        this.subscription.set(null);
        return 'gone';
      case UserDeviceErrorCodes.TestRateLimited:
        return 'rate-limited';
      default:
        return 'failed';
    }
  }

  /**
   * Starts the sync: each time a verified customer is signed in, this browser's subscription is
   * registered again. That updates "last seen", and the API keeps only the 20 devices seen most
   * recently. Called once, from the app's initializer.
   */
  start(): void {
    const account = this.account;
    if (this.started || account === null || this.browser.environment() === null) return;
    this.started = true;

    effect(
      () => {
        if (!account.verified()) return;
        untracked(() => {
          void this.sync();
        });
      },
      { injector: this.injector },
    );
  }

  /** Registers an existing subscription again, and renews it when the API's key changed. */
  async sync(): Promise<void> {
    const environment = this.browser.environment();
    if (environment === null || environmentState(environment) !== 'push') return;
    if (this.browser.permission() !== 'granted') return;

    try {
      const existing = await this.readSubscription();
      if (existing === null) return;

      const key = await this.loadPublicKey();
      if (key === null) return;

      let subscription = existing;
      if (!sameKey(existing.options.applicationServerKey, key)) {
        const registration = await this.browser.registration();
        if (registration === null) return;
        subscription = await this.subscribe(registration, key);
      }

      await this.registerDevice(subscription, environment);
      this.subscription.set(subscription);
    } catch (error) {
      if (isDevMode()) console.error('[reminders] could not sync the push device', error);
    }
  }

  private async read(): Promise<void> {
    const environment = this.browser.environment();
    if (environment === null) return;
    this.environment.set(environment);

    const local = environmentState(environment);
    if (local === 'unsupported') return;

    if (local === 'push') {
      this.permission.set(this.browser.permission());
      this.browser.onPermissionChange(() => {
        void this.refresh();
      });
      this.subscription.set(await this.readSubscription());
    }
    await this.loadPublicKey();
  }

  /** After a change in the browser's settings. A revoked permission also drops the subscription. */
  private async refresh(): Promise<void> {
    this.permission.set(this.browser.permission());
    this.subscription.set(await this.readSubscription());
  }

  private async readSubscription(): Promise<PushSubscription | null> {
    try {
      const registration = await this.browser.registration();
      return (await registration?.pushManager.getSubscription()) ?? null;
    } catch {
      return null;
    }
  }

  /** The VAPID key. `null` when the environment has none, or when the read failed. */
  private loadPublicKey(): Promise<string | null> {
    this.publicKey ??= firstValueFrom(this.api.publicKey()).then((result) => {
      if (result.isSuccess && result.data !== null) {
        this.server.set('configured');
        return result.data.publicKey;
      }
      if (!result.isSuccess && result.error.errorCode === UserDeviceErrorCodes.PushNotConfigured) {
        this.server.set('not-configured');
        return null;
      }
      // A network failure. Ask again next time.
      this.publicKey = null;
      return null;
    });
    return this.publicKey;
  }

  /** The existing subscription when it uses this key. A subscription with an old key is replaced. */
  private async subscribe(
    registration: ServiceWorkerRegistration,
    key: string,
  ): Promise<PushSubscription> {
    const existing = await registration.pushManager.getSubscription();
    if (existing !== null) {
      if (sameKey(existing.options.applicationServerKey, key)) return existing;
      await existing.unsubscribe();
    }
    return registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: decodeBase64Url(key),
    });
  }

  /** One retry on a conflict: another tab registered the same browser at the same moment. */
  private async registerDevice(
    subscription: PushSubscription,
    environment: PushEnvironment,
  ): Promise<boolean> {
    const keys = subscription.toJSON().keys;
    const p256dh = keys?.['p256dh'];
    const auth = keys?.['auth'];
    if (p256dh === undefined || auth === undefined) return false;

    const body = {
      endpoint: subscription.endpoint,
      keys: { p256dh, auth },
      label: deviceLabel(environment),
      platform: 'web',
    } as const;

    for (let attempt = 0; attempt < 2; attempt++) {
      const result = await firstValueFrom(this.api.register(body));
      if (result.isSuccess) return true;
      if (result.error.errorCode !== UserDeviceErrorCodes.RegisterConflict) return false;
    }
    return false;
  }
}
