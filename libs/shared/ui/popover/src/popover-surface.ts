import { NgTemplateOutlet } from '@angular/common';
import { Component, ElementRef, inject, input, signal, TemplateRef } from '@angular/core';

// Fallback for animateOut when no `animationend` arrives (e.g. test
// environments without CSS animations) — leave duration plus margin.
const LEAVE_FALLBACK_MS = 250;

/** Side of the anchor the surface settled on, for origin-aware motion. */
export type PopoverSurfacePosition = 'top' | 'bottom';

/**
 * The visible dialog surface of a declarative popover — a card with
 * `role="dialog"` semantics that projects the trigger's content
 * template. Internal: created inside a CDK overlay by the
 * `libPopoverTriggerFor` directive, never used directly in templates.
 */
@Component({
  selector: 'lib-popover-surface',
  imports: [NgTemplateOutlet],
  template: `
    @if (visible()) {
      <div
        class="popover-surface"
        role="dialog"
        tabindex="-1"
        animate.enter="popover-enter"
        animate.leave="popover-leave"
        [id]="id()"
        [attr.aria-label]="ariaLabel() || null"
        [attr.aria-labelledby]="ariaLabelledby() || null"
        [attr.data-position]="position()"
      >
        <ng-container *ngTemplateOutlet="content()" />
      </div>
    }
  `,
  styleUrl: './popover-surface.scss',
})
export class PopoverSurface {
  private readonly elementRef = inject<ElementRef<HTMLElement>>(ElementRef);

  /** Id of the dialog, referenced by the trigger's `aria-controls`. */
  readonly id = input.required<string>();

  /** The content projected inside the dialog. */
  readonly content = input.required<TemplateRef<unknown>>();

  /** Accessible name of the dialog. */
  readonly ariaLabel = input('');

  /** Id of the element that labels the dialog. */
  readonly ariaLabelledby = input('');

  /** Side of the anchor the surface landed on. */
  readonly position = input<PopoverSurfacePosition>('bottom');

  protected readonly visible = signal(true);

  /** The `role="dialog"` element, for the trigger to move focus into. */
  get dialogElement(): HTMLElement | null {
    return this.elementRef.nativeElement.querySelector<HTMLElement>('[role="dialog"]');
  }

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
        if (event.animationName.includes('popover-out')) {
          finish();
        }
      };

      host.addEventListener('animationend', onAnimationEnd);
      this.visible.set(false);
      setTimeout(finish, LEAVE_FALLBACK_MS);
    });
  }
}
