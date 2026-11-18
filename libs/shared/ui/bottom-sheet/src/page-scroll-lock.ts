/**
 * Reference-counted page scroll lock.
 *
 * Counted rather than toggled: with two holders, releasing one must not hand
 * scrolling back while the other is still up. The inline `overflow` from before
 * the first lock is restored on the last release, so a page that sets its own
 * keeps it.
 *
 * NOTE: `@ui/drawer` carries an identical copy. Neither library exports it, and
 * a shared home for three lines of DOM state has not earned itself yet.
 */

import type { ScrollLockState } from './page-scroll-lock.types';

const locks = new WeakMap<Document, ScrollLockState>();

export function acquireScrollLock(document: Document): void {
  const state = locks.get(document);
  if (state) {
    state.count++;
    return;
  }
  locks.set(document, { count: 1, previousOverflow: document.body.style.overflow });
  document.body.style.overflow = 'hidden';
}

export function releaseScrollLock(document: Document): void {
  const state = locks.get(document);
  if (!state) return;

  state.count--;
  if (state.count > 0) return;

  document.body.style.overflow = state.previousOverflow;
  locks.delete(document);
}
