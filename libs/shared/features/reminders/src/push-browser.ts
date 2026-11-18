import { DOCUMENT, isPlatformBrowser } from '@angular/common';
import { PLATFORM_ID, Service, inject } from '@angular/core';

import { detectPushEnvironment } from './core/push-environment';
import type { PushEnvironment } from './core/push-environment.types';

/** The worker that shows the reminders. `server.ts` serves it without a cache. */
const WORKER_URL = '/sw.js';
const WORKER_SCOPE = '/';

/**
 * The browser's push APIs, in one place, so the specs can replace them. Every method assumes the
 * browser: {@link environment} answers `null` on the server, and nothing else runs there.
 */
@Service()
export class PushBrowser {
  private readonly window = inject(DOCUMENT).defaultView;
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  /** The facts about this browser. `null` on the server. */
  environment(): PushEnvironment | null {
    const window = this.window;
    if (!this.isBrowser || window === null) return null;

    const navigator = window.navigator as Navigator & { standalone?: boolean };
    return detectPushEnvironment({
      userAgent: navigator.userAgent,
      maxTouchPoints: navigator.maxTouchPoints,
      standalone:
        window.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true,
      pushApi: 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window,
    });
  }

  permission(): NotificationPermission {
    return Notification.permission;
  }

  /** Shows the browser's question. Must run inside a click handler. */
  requestPermission(): Promise<NotificationPermission> {
    return Notification.requestPermission();
  }

  /** Calls `listener` when the permission changes in the browser's settings. */
  onPermissionChange(listener: () => void): void {
    // Safari has no change event for notifications. A return to the tab covers it.
    this.window?.document.addEventListener('visibilitychange', () => {
      if (this.window?.document.visibilityState === 'visible') listener();
    });
    void this.window?.navigator.permissions
      .query({ name: 'notifications' })
      .then((status) => {
        status.addEventListener('change', listener);
      })
      .catch(() => undefined);
  }

  /** The worker registered earlier, if any. Registering it is {@link registerWorker}'s job. */
  async registration(): Promise<ServiceWorkerRegistration | null> {
    const navigator = this.window?.navigator;
    if (navigator === undefined || !('serviceWorker' in navigator)) return null;
    return (await navigator.serviceWorker.getRegistration(WORKER_SCOPE)) ?? null;
  }

  /** Registers the worker and waits until it is active, which `subscribe` needs. */
  async registerWorker(): Promise<ServiceWorkerRegistration> {
    const container = this.window?.navigator.serviceWorker;
    if (container === undefined) throw new Error('Service workers are not available.');
    await container.register(WORKER_URL, { scope: WORKER_SCOPE, updateViaCache: 'none' });
    return container.ready;
  }
}
