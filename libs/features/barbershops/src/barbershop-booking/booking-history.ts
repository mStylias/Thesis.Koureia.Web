import { Location, isPlatformBrowser } from '@angular/common';
import { DestroyRef, PLATFORM_ID, Service, inject } from '@angular/core';

import type { BookingStepId } from './booking.types';

/** The state key the entries carry. Anything without it is not ours to restore. */
const STEP_KEY = 'bookingStep';

/**
 * Makes the browser's back button undo one section of the flow at a time.
 *
 * ```ts
 * history.start('services', (step) => { … });
 * history.push('barber');   // after every step change
 * ```
 *
 * **A section, never a choice.** One entry per step, pushed when the step changes and by
 * nothing else. Back returns to the step before, with everything chosen in it intact: a
 * customer who picked three services and pressed back expects the services step, not two
 * services. Back from the first step finds no entry of ours and leaves the page, which is
 * where the customer came from.
 *
 * The URL never changes. The push is made with the address the page is already on, so the
 * address bar stays put and nothing about the selection is shareable.
 *
 * Two deliberate limits:
 *
 * - **It does not survive a refresh.** The browser keeps the entries, the array does not.
 *   `start` seeds a fresh stack and replaces the baseline, so the draft is intact and only the
 *   undo history is shorter.
 * - **It does not survive the round trip to Keycloak**, for the same reason and with the same
 *   handling.
 *
 * The `Router` is not involved: the route never changes, so this drives `Location` directly.
 */
@Service()
export class BookingHistory {
  private readonly location = inject(Location);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private readonly destroyRef = inject(DestroyRef);

  private steps: BookingStepId[] = [];
  private index = 0;
  private restore: ((step: BookingStepId) => void) | null = null;
  private listening = false;

  /**
   * Begins a stack with `step` as its only entry and replaces the current history entry with
   * the baseline. Called on load and again whenever the flow restarts.
   */
  start(step: BookingStepId, restore: (step: BookingStepId) => void): void {
    if (!this.isBrowser) return;

    this.steps = [step];
    this.index = 0;
    this.restore = restore;
    this.location.replaceState(this.location.path(true), '', this.stateWith(0));

    if (this.listening) return;
    this.listening = true;
    const subscription = this.location.subscribe((event) => {
      this.onPop(event.pop === true);
    });
    this.destroyRef.onDestroy(() => {
      subscription.unsubscribe();
    });
  }

  /**
   * Records a step change.
   *
   * Anything ahead of the current index is dropped first: moving on after going back is a new
   * branch, and the entries it replaces are no longer reachable anyway.
   */
  push(step: BookingStepId): void {
    if (!this.isBrowser || this.restore === null) return;

    this.steps = [...this.steps.slice(0, this.index + 1), step];
    this.index = this.steps.length - 1;
    // The address it is already on: a history entry, not a route change.
    this.location.go(this.location.path(true), '', this.stateWith(this.index));
  }

  /** Whether going back would leave the page rather than return to a step. */
  atStart(): boolean {
    return this.index === 0;
  }

  private stateWith(index: number): Record<string, unknown> {
    return { ...(this.location.getState() as object | null), [STEP_KEY]: index };
  }

  private onPop(popped: boolean): void {
    if (!popped || this.restore === null) return;

    const state = this.location.getState() as Record<string, unknown> | null;
    const target = state?.[STEP_KEY];
    // Not one of ours: a history entry from before the page, or from another feature. Letting
    // it through is what makes back past the first step leave the page, which is correct.
    if (typeof target !== 'number') return;

    if (target < 0 || target >= this.steps.length) return;

    this.index = target;
    // Restoring must not push, or every back press would append the entry it just consumed.
    this.restore(this.steps[target]);
  }
}
