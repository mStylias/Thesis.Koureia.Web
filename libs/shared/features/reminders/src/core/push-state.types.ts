import type { PushEnvironment } from './push-environment.types';

/**
 * The push state of this browser. Every screen reads it.
 *
 * - `unknown` — on the server, or not checked yet. Nothing renders.
 * - `unsupported` — no push here, or the environment has no push keys.
 * - `in-app-browser` — an in-app browser. The guide says to open the page in the browser.
 * - `needs-home-screen` — an iPhone or iPad outside the Home Screen app.
 * - `available` — the browser has not asked yet.
 * - `off` — permission granted, no subscription.
 * - `on` — subscribed and registered.
 * - `blocked` — permission refused.
 */
export type PushState =
  | 'unknown'
  | 'unsupported'
  | 'in-app-browser'
  | 'needs-home-screen'
  | 'available'
  | 'off'
  | 'on'
  | 'blocked';

/** Whether the API has push keys. `unknown` until the public key read answers. */
export type PushServer = 'unknown' | 'configured' | 'not-configured';

/** The facts the state is derived from. `null` is a fact not read yet. */
export interface PushStateInput {
  readonly environment: PushEnvironment | null;
  readonly server: PushServer;
  readonly permission: NotificationPermission | null;
  readonly subscribed: boolean | null;
}
