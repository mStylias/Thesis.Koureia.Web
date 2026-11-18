/**
 * Reference-counted page scroll lock, shared by every drawer instance.
 *
 * Locking has to be counted rather than toggled: with two scroll-blocking
 * drawers open, closing one must not hand scrolling back to the page while
 * the other is still up. The inline `overflow` in place before the first
 * lock is captured and restored on the last release, so a page that sets
 * its own `body` overflow keeps it.
 */

interface ScrollLockState {
  /** Number of holders currently keeping the page locked. */
  count: number;
  /** Inline `body` overflow from before the first lock. */
  previousOverflow: string;
}

const locks = new WeakMap<Document, ScrollLockState>();

/** Takes a lock on the page's scrolling; pair with `releaseScrollLock`. */
export function acquireScrollLock(document: Document): void {
  const state = locks.get(document);
  if (state) {
    state.count++;
    return;
  }
  locks.set(document, {
    count: 1,
    previousOverflow: document.body.style.overflow,
  });
  document.body.style.overflow = 'hidden';
}

/** Releases one lock; the page scrolls again once the last one goes. */
export function releaseScrollLock(document: Document): void {
  const state = locks.get(document);
  if (!state) {
    return;
  }
  state.count--;
  if (state.count > 0) {
    return;
  }
  document.body.style.overflow = state.previousOverflow;
  locks.delete(document);
}
