import { Directive, ElementRef, afterNextRender, effect, inject, input } from '@angular/core';

/**
 * Replays a CSS animation whenever the value bound to it changes.
 *
 * ```html
 * <span [libReplayOnChange]="total()" animationClass="total-enter">{{ total() }}</span>
 * ```
 *
 * `animate.enter` fires when an element is created, so a line rewritten in place — an amount,
 * a caption, the sheet's bar — never animates at all. Keying a one-item `@for` on the value
 * recreates the element and does animate, but Angular reports that as NG0956 on every change.
 *
 * The first value is not a change, so it is not animated. That also keeps the first paint
 * still: a resumed draft renders with a total and a caption it did not just earn.
 */
@Directive({
  selector: '[libReplayOnChange]',
})
export class ReplayOnChange {
  /** The value to watch. Anything comparable by identity. */
  readonly value = input.required<unknown>({ alias: 'libReplayOnChange' });

  /** The class carrying the animation. Empty withholds the replay. */
  readonly animationClass = input.required<string>();

  private readonly element = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;

  /** Guards the server render and the first paint, neither of which is a change. */
  private live = false;

  constructor() {
    afterNextRender(() => {
      this.live = true;
    });

    effect(() => {
      this.value();
      const className = this.animationClass();
      if (!this.live || className === '') return;

      this.element.classList.remove(className);
      // Reading a layout property flushes the removal. Without it the browser collapses both
      // writes into one frame, the class never leaves, and the animation does not restart.
      void this.element.offsetWidth;
      this.element.classList.add(className);
    });
  }
}
