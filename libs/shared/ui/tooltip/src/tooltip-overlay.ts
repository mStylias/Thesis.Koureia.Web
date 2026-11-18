import { NgTemplateOutlet } from '@angular/common';
import { Component, ElementRef, inject, input, signal, TemplateRef } from '@angular/core';
import { TooltipPosition } from './tooltip-positions';

// Fallback for animateOut when no `animationend` arrives (e.g. test
// environments without CSS animations) — leave duration plus margin.
const LEAVE_FALLBACK_MS = 250;

/**
 * The tooltip surface. Internal — created inside a CDK overlay by the
 * `libTooltip` directive, never used directly in templates.
 */
@Component({
  selector: 'lib-tooltip-overlay',
  imports: [NgTemplateOutlet],
  template: `
    @if (visible()) {
      <div
        class="tooltip-surface"
        role="tooltip"
        animate.enter="tooltip-enter"
        animate.leave="tooltip-leave"
        [id]="id()"
        [attr.data-position]="position()"
      >
        @if (template(); as tooltipTemplate) {
          <ng-container *ngTemplateOutlet="tooltipTemplate" />
        } @else {
          {{ content() }}
        }
      </div>
    }
  `,
  styleUrl: './tooltip-overlay.scss',
})
export class TooltipOverlay {
  private readonly elementRef = inject<ElementRef<HTMLElement>>(ElementRef);

  /** Target of the host's `aria-describedby`. */
  readonly id = input.required<string>();

  /** Plain-text content; ignored when a template is set. */
  readonly content = input('');

  /** Rich content rendered instead of `content`. */
  readonly template = input<TemplateRef<unknown> | undefined>(undefined);

  /** Side of the target the overlay landed on. */
  readonly position = input<TooltipPosition>('top');

  protected readonly visible = signal(true);

  /**
   * Plays the leave animation (`animate.leave` keeps the surface in the
   * DOM until it finishes) and resolves once it is safe to detach the
   * overlay.
   */
  animateOut(): Promise<void> {
    if (!this.visible()) {
      return Promise.resolve();
    }

    return new Promise((resolve) => {
      const host = this.elementRef.nativeElement;
      let settled = false;

      const finish = (): void => {
        if (settled) {
          return;
        }
        settled = true;
        host.removeEventListener('animationend', onAnimationEnd);
        resolve();
      };

      const onAnimationEnd = (event: AnimationEvent): void => {
        // Emulated encapsulation rewrites keyframe names, so match
        // loosely instead of comparing exactly.
        if (event.animationName.includes('tooltip-out')) {
          finish();
        }
      };

      host.addEventListener('animationend', onAnimationEnd);
      this.visible.set(false);
      setTimeout(finish, LEAVE_FALLBACK_MS);
    });
  }
}
