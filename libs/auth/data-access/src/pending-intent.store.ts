import { isPlatformBrowser } from '@angular/common';
import { PLATFORM_ID, Service, inject, isDevMode } from '@angular/core';

/**
 * What a person was in the middle of when the app sent them to Keycloak.
 *
 * `kind` names the flow that recorded it, so a reader can refuse an entry it does not
 * understand instead of handing a booking payload to a profile screen. `payload` stays opaque:
 * this store survives a redirect, and does not know what a booking is.
 */
export interface PendingIntent {
  /** The flow that recorded it. */
  readonly kind: string;
  /** Whatever that flow needs back. Must serialize to JSON. */
  readonly payload: unknown;
}

/**
 * A selection that outlives a round trip to Keycloak: sign-in, sign-up, verification, a refresh
 * and a reopened tab.
 *
 * ```ts
 * intents.record({ kind: 'booking', payload: { shopId, serviceId, slot } });
 * session.signIn(router.url);
 * // …after the callback
 * const intent = intents.consume();
 * ```
 *
 * Three choices make it work:
 *
 * - **`sessionStorage`, not `localStorage`.** The intent belongs to the tab that formed it. In
 *   `localStorage` one tab's selection becomes another tab's, and outlives the browser session.
 * - **Versioned.** {@link INTENT_VERSION} is written in and checked on read, so a shape change
 *   makes an old entry invalid instead of crashing a reader that half-understands it. A tab open
 *   across a deploy still holds the old shape.
 * - **Consumed explicitly.** Only {@link consume} clears. A flow that reads with {@link peek},
 *   fails, and retries keeps its intent. The tab closing is the only expiry.
 *
 * Every method is a no-op or `null` outside the browser, so no server-rendered page can carry one
 * visitor's intent.
 *
 * NOTE: Recording stays out of `signIn()` and `signUp()`. An intent outlives more than the
 * sign-in redirect, and a caller that names what it resumes cannot resume the wrong thing.
 */
@Service()
export class PendingIntentStore {
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  /** Replaces any intent already recorded: one tab, one thing in flight. */
  record(intent: PendingIntent): void {
    if (!this.isBrowser) return;

    let serialised: string;
    try {
      serialised = JSON.stringify({
        version: INTENT_VERSION,
        kind: intent.kind,
        payload: intent.payload ?? null,
      });
    } catch {
      // A payload with a cycle in it. The old entry must go too, because it would resume the
      // previous selection after the redirect, which is worse than resuming nothing.
      if (isDevMode()) console.error('[auth] pending intent is not serialisable', intent.kind);
      this.clear();
      return;
    }

    try {
      sessionStorage.setItem(INTENT_KEY, serialised);
    } catch {
      // Private-mode quota refusal. The redirect must still happen, so the person arrives back
      // without a selection rather than not arriving back.
      if (isDevMode()) console.warn('[auth] could not record the pending intent');
    }
  }

  /** Reads without clearing. For a caller that may yet fail and try again. */
  peek(): PendingIntent | null {
    if (!this.isBrowser) return null;

    let raw: string | null;
    try {
      raw = sessionStorage.getItem(INTENT_KEY);
    } catch {
      return null;
    }
    if (raw === null) return null;

    const intent = parseIntent(raw);
    // Unreadable or an older shape. Dropped here, not on the next write, so one bad entry cannot
    // sit in a tab and answer `null` forever.
    if (!intent) this.clear();
    return intent;
  }

  /** Reads and clears. The explicit "this has been acted on" step. */
  consume(): PendingIntent | null {
    const intent = this.peek();
    this.clear();
    return intent;
  }

  clear(): void {
    if (!this.isBrowser) return;

    try {
      sessionStorage.removeItem(INTENT_KEY);
    } catch {
      // Nothing to do and nothing worth failing for.
    }
  }
}

/** Raise this whenever the stored shape changes. The reader checks it and drops an old entry. */
const INTENT_VERSION = 1;

const INTENT_KEY = 'koureia.intent.v1';

function parseIntent(raw: string): PendingIntent | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }

  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) return null;

  const entry = parsed as Record<string, unknown>;
  if (entry['version'] !== INTENT_VERSION) return null;
  if (typeof entry['kind'] !== 'string' || entry['kind'] === '') return null;

  return { kind: entry['kind'], payload: entry['payload'] ?? null };
}
