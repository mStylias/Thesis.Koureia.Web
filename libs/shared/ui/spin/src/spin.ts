import { isPlatformBrowser } from '@angular/common';
import {
  booleanAttribute,
  Directive,
  ElementRef,
  inject,
  input,
  linkedSignal,
  PLATFORM_ID,
} from '@angular/core';

/** The keyframes of `components/_spin.scss`. An event from any other animation is not a turn. */
export const SPIN_ANIMATIONS: ReadonlySet<string> = new Set(['lib-spin-lead', 'lib-spin-loop']);

/**
 * Turns an icon while work runs, and lets the turn in progress finish when the work ends. The
 * icon comes to rest where it started, so it never snaps back.
 *
 * ```ts
 * import { Spin } from '@ui/spin';
 * ```
 *
 * ```html
 * <button libButton iconOnly [attr.aria-busy]="loading() || null" aria-label="Refresh">
 *   <svg lucideRefreshCw [libSpin]="loading()" aria-hidden="true"></svg>
 * </button>
 * ```
 *
 * The first turn eases out, so the icon moves on the frame of the press. Each turn after it
 * eases in and out and stops at rest on the turn boundary, which is the only place the spin
 * ends. A load shorter than one turn still gets that full turn.
 *
 * The icon is decoration. Put `aria-busy` on the control and keep the icon `aria-hidden`.
 */
@Directive({
  selector: '[libSpin]',
  host: {
    'data-lib-spin': '',
    '[attr.data-spinning]': 'spinning() ? "" : null',
    '(animationiteration)': 'onTurn($event)',
    '(animationend)': 'onTurn($event)',
    '(animationcancel)': 'onTurn($event)',
  },
})
export class Spin {
  private readonly host = inject<ElementRef<Element>>(ElementRef).nativeElement;
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  /** Work is running. When it goes false, the icon finishes its turn and stops. */
  readonly active = input(false, { alias: 'libSpin', transform: booleanAttribute });

  /** The icon turns: the work runs, or the last turn has not come to rest yet. */
  protected readonly spinning = linkedSignal<boolean, boolean>({
    source: this.active,
    computation: (active, previous) => active || (previous?.value === true && this.turning()),
  });

  protected onTurn(event: AnimationEvent): void {
    // The events bubble, so an animation inside the host must not stop the spin.
    if (event.target !== this.host || !SPIN_ANIMATIONS.has(event.animationName)) {
      return;
    }
    if (!this.active()) {
      this.spinning.set(false);
    }
  }

  /**
   * Whether a spin animation runs, so a turn boundary will come. Reduced motion, a hidden host
   * and the server run none, and a spin that waited for a boundary there would never stop.
   */
  private turning(): boolean {
    if (!this.isBrowser) {
      return false;
    }
    // No Web Animations API, as in jsdom: assume the turn runs and wait for its event.
    if (typeof this.host.getAnimations !== 'function') {
      return true;
    }
    return this.host
      .getAnimations()
      .some((animation) =>
        SPIN_ANIMATIONS.has((animation as Partial<CSSAnimation>).animationName ?? ''),
      );
  }
}
