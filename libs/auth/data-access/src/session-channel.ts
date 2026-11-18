import { DestroyRef, Service, inject, isDevMode } from '@angular/core';

/**
 * The only message this channel carries. It says a session ended and nothing else.
 *
 * WARNING: Never put a token, a subject or an email on this channel. `BroadcastChannel` reaches
 * every same-origin context, and a credential on it is a credential published.
 */
const SESSION_ENDED = 'session-ended';

/**
 * The second message. It says the claims are no longer what the other tabs hold, and nothing
 * else — the receiver asks the BFF what they are now.
 */
const SESSION_CHANGED = 'session-changed';

const CHANNEL_NAME = 'koureia.auth.v1';

/**
 * Sign-out in one tab, reaching the others, and the same for a session whose claims changed.
 *
 * Only the fact travels, never the claims. A sign-in still cannot: each tab holds its tokens in
 * memory, and each tab restores its own session on the next load.
 */
@Service()
export class SessionChannel {
  private readonly channel = openChannel();

  private onEnded: (() => void) | undefined;
  private onChanged: (() => void) | undefined;

  constructor() {
    inject(DestroyRef).onDestroy(() => this.channel?.close());

    // One handler for both messages. `onmessage` is a single slot, so two registrations that
    // each assigned it would leave only the later one listening.
    if (this.channel) {
      this.channel.onmessage = (event: MessageEvent<unknown>) => {
        if (event.data === SESSION_ENDED) this.onEnded?.();
        else if (event.data === SESSION_CHANGED) this.onChanged?.();
      };
    }
  }

  /** Runs `onEnded` when another tab signs out. Never fires for this tab's own sign-out. */
  listen(onEnded: () => void): void {
    this.onEnded = onEnded;
  }

  /** Runs `onChanged` when another tab replaced its session claims. */
  listenChanged(onChanged: () => void): void {
    this.onChanged = onChanged;
  }

  announceEnded(): void {
    this.channel?.postMessage(SESSION_ENDED);
  }

  announceChanged(): void {
    this.channel?.postMessage(SESSION_CHANGED);
  }
}

/**
 * `null` on the server and on a browser without `BroadcastChannel`. Cross-tab sign-out improves
 * safety but is not required: each tab still finds the ended session on its next request.
 */
function openChannel(): BroadcastChannel | null {
  if (typeof BroadcastChannel === 'undefined') return null;

  try {
    return new BroadcastChannel(CHANNEL_NAME);
  } catch {
    if (isDevMode()) console.warn('[auth] BroadcastChannel unavailable; sign-out is per-tab');
    return null;
  }
}
