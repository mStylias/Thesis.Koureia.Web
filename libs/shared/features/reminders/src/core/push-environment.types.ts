/** The device family the setup guide opens on. */
export type PushOs = 'ios' | 'android' | 'desktop';

/** The browser family. The unblock steps differ per family. */
export type PushBrowserFamily = 'safari' | 'chrome' | 'edge' | 'firefox' | 'samsung' | 'other';

/** What the browser tells about itself, read once in the browser. */
export interface PushEnvironmentInput {
  readonly userAgent: string;
  readonly maxTouchPoints: number;
  /** The page runs as an installed app, from the Home Screen. */
  readonly standalone: boolean;
  /** `serviceWorker`, `PushManager` and `Notification` all exist. */
  readonly pushApi: boolean;
}

/** The facts about this browser that decide the push state and the guide. */
export interface PushEnvironment {
  readonly os: PushOs;
  readonly browser: PushBrowserFamily;
  /** `Windows`, `macOS`, `Linux`, `ChromeOS`, `Android`, `iOS` or `iPadOS`. Product names, not copy. */
  readonly osName: string;
  /** `Chrome`, `Safari`, `Edge`, `Firefox`, `Samsung Internet` or `Browser`. */
  readonly browserName: string;
  /** Facebook, Instagram, Viber and similar apps, or an Android WebView. */
  readonly inAppBrowser: boolean;
  readonly standalone: boolean;
  /** Major and minor version on iOS and iPadOS. `null` elsewhere, or when the agent hides it. */
  readonly iosVersion: readonly [number, number] | null;
  readonly pushApi: boolean;
}

/**
 * What the browser alone allows, before permission and the API are asked:
 *
 * - `push` — the browser can subscribe. Permission decides the rest.
 * - `in-app-browser`, `needs-home-screen`, `unsupported` — final, whatever the permission.
 */
export type PushEnvironmentState = 'push' | 'in-app-browser' | 'needs-home-screen' | 'unsupported';
