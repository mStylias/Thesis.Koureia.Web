import { isPlatformBrowser } from '@angular/common';
import { PLATFORM_ID, Service, inject, isDevMode } from '@angular/core';
import { BRAND } from '@util/brand';

import type { BookingDraft, BookingStepId } from './booking.types';

/**
 * An unfinished selection, kept across a refresh, a browser restart and the round trip to
 * Keycloak.
 *
 * ```ts
 * drafts.save(draft);
 * const resumed = drafts.load(slug);
 * ```
 *
 * Four choices make it work:
 *
 * - **`localStorage`, not `sessionStorage`.** The draft has to outlive the tab, which is more
 *   than `PendingIntentStore` promises. That is why the booking flow does not use it.
 * - **One key per shop.** A customer comparing two shops keeps both drafts. Browsing a second
 *   shop must not silently discard the first.
 * - **Six hours.** Older than that and the chosen slot has almost certainly gone, so the entry
 *   is dropped on read rather than resumed into a repair the customer did not ask for.
 * - **Versioned.** {@link DRAFT_VERSION} is written in and checked on read, so a shape change
 *   invalidates an old entry instead of half-loading it into a reader that misunderstands it.
 *
 * Every method is a no-op or `null` outside the browser, so no server-rendered page can carry
 * one visitor's selection.
 */
@Service()
export class BookingDraftStore {
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  /**
   * Namespaces the keys. Read from the brand rather than written as a literal: one deployment
   * can serve several brands from one origin, and their drafts must not read each other's.
   */
  private readonly prefix = `${inject(BRAND).id}.booking.draft.v${String(DRAFT_VERSION)}.`;

  /** Reads this shop's draft, dropping it when it is stale, unreadable or an older shape. */
  load(slug: string): BookingDraft | null {
    if (!this.isBrowser) return null;

    this.sweep();

    let raw: string | null;
    try {
      raw = localStorage.getItem(this.keyFor(slug));
    } catch {
      return null;
    }
    if (raw === null) return null;

    const draft = parseDraft(raw, slug);
    // Dropped here rather than on the next write, so one bad entry cannot sit in a browser and
    // answer `null` forever.
    if (draft === null) this.clear(slug);
    return draft;
  }

  /** Replaces this shop's draft. Stamps `savedAt`, so the caller never has to. */
  save(draft: BookingDraft): void {
    if (!this.isBrowser) return;

    const stamped: BookingDraft = { ...draft, savedAt: new Date().toISOString() };
    try {
      localStorage.setItem(
        this.keyFor(draft.slug),
        JSON.stringify({ version: DRAFT_VERSION, ...stamped }),
      );
    } catch {
      // Private-mode quota refusal. The booking must still be possible, so the customer
      // carries on without a draft rather than being stopped here.
      if (isDevMode()) console.warn('[booking] could not save the draft');
    }
  }

  clear(slug: string): void {
    if (!this.isBrowser) return;

    try {
      localStorage.removeItem(this.keyFor(slug));
    } catch {
      // Nothing to do and nothing worth failing for.
    }
  }

  /**
   * Drops every expired draft, this shop's and every other shop's.
   *
   * Without it a customer who browses many shops accumulates a key per shop forever, and only
   * the one they return to is ever read again.
   */
  private sweep(): void {
    let keys: string[];
    try {
      keys = Object.keys(localStorage).filter((key) => key.startsWith(this.prefix));
    } catch {
      return;
    }

    for (const key of keys) {
      try {
        const raw = localStorage.getItem(key);
        if (raw !== null && !isFresh(raw)) localStorage.removeItem(key);
      } catch {
        // One unreadable key is not a reason to abandon the rest.
      }
    }
  }

  private keyFor(slug: string): string {
    return `${this.prefix}${slug}`;
  }
}

/** Raise this whenever {@link BookingDraft} changes. The reader checks it and drops an old entry. */
const DRAFT_VERSION = 1;

/** Six hours, in milliseconds. */
export const DRAFT_MAX_AGE_MS = 6 * 60 * 60 * 1000;

const STEP_IDS: readonly BookingStepId[] = ['shop', 'services', 'barber', 'when', 'confirm'];

function isFresh(raw: string): boolean {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return false;
  }
  if (typeof parsed !== 'object' || parsed === null) return false;

  const savedAt = (parsed as Record<string, unknown>)['savedAt'];
  if (typeof savedAt !== 'string') return false;

  const age = Date.now() - Date.parse(savedAt);
  return Number.isFinite(age) && age >= 0 && age < DRAFT_MAX_AGE_MS;
}

function parseDraft(raw: string, slug: string): BookingDraft | null {
  if (!isFresh(raw)) return null;

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) return null;

  const entry = parsed as Record<string, unknown>;
  if (entry['version'] !== DRAFT_VERSION) return null;
  // A key that does not hold the shop it is named for is a hand-edited entry, not a draft.
  if (entry['slug'] !== slug) return null;

  const serviceIds = entry['serviceIds'];
  if (!Array.isArray(serviceIds) || !serviceIds.every((id) => typeof id === 'string')) return null;

  const step = entry['step'];

  return {
    slug,
    serviceIds,
    staffMemberId: asNullableString(entry['staffMemberId']),
    date: asNullableString(entry['date']),
    time: asNullableString(entry['time']),
    startsAtUtc: asNullableString(entry['startsAtUtc']),
    notes: typeof entry['notes'] === 'string' ? entry['notes'] : '',
    step: isStepId(step) ? step : 'services',
    savedAt: entry['savedAt'] as string,
  };
}

function asNullableString(value: unknown): string | null {
  return typeof value === 'string' ? value : null;
}

function isStepId(value: unknown): value is BookingStepId {
  return typeof value === 'string' && STEP_IDS.includes(value as BookingStepId);
}
