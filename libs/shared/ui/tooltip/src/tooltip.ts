import { Overlay, OverlayRef } from '@angular/cdk/overlay';
import { ComponentPortal } from '@angular/cdk/portal';
import {
  booleanAttribute,
  ComponentRef,
  computed,
  Directive,
  DOCUMENT,
  effect,
  ElementRef,
  inject,
  input,
  numberAttribute,
  OnDestroy,
  signal,
  TemplateRef,
} from '@angular/core';
import { Subscription } from 'rxjs';
import { TooltipOverlay } from './tooltip-overlay';
import {
  buildTooltipPositions,
  resolveTooltipPosition,
  TooltipPosition,
} from './tooltip-positions';

let nextTooltipId = 0;

// One tooltip visible at a time: a new one snaps the previous away with no leave
// animation, so adjacent triggers never overlap.
let activeTooltip: Tooltip | null = null;

/** Milliseconds, floored at zero; anything unusable becomes no delay. */
function clampDelay(value: number): number {
  return Number.isFinite(value) && value > 0 ? value : 0;
}

/**
 * Design-system tooltip — short advisory text anchored to any
 * element, rendered in a CDK overlay:
 *
 * ```ts
 * import { Tooltip } from '@ui/tooltip';
 * ```
 *
 * ```html
 * <button libButton libTooltip="Save changes">Save</button>
 * <button libTooltip="Delete" tooltipPosition="right">…</button>
 * ```
 *
 * Rich content via a template reference:
 *
 * ```html
 * <ng-template #tip>Opens <strong>Monday</strong></ng-template>
 * <span [libTooltip]="tip">Hours</span>
 * ```
 *
 * Follows WCAG 1.4.13: hover *and* keyboard focus, hoverable, Escape-dismissible. While
 * open the host is described by it, alongside any `aria-describedby` it already carried.
 * Flips when the preferred position does not fit.
 */
@Directive({
  selector: '[libTooltip]',
  host: {
    '(mouseenter)': 'onPointerEnter()',
    '(mouseleave)': 'onPointerLeave()',
    '(focusin)': 'onFocusIn()',
    '(focusout)': 'onFocusOut($event)',
    '(click)': 'onHostClick()',
    '[attr.aria-describedby]': 'describedBy()',
  },
})
export class Tooltip implements OnDestroy {
  private readonly overlay = inject(Overlay);
  private readonly elementRef = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly document = inject(DOCUMENT);

  /** Tooltip content — plain text or a template reference. */
  readonly libTooltip = input.required<string | TemplateRef<unknown>>();

  /** Preferred side; flips automatically when it does not fit. */
  readonly tooltipPosition = input<TooltipPosition>('top');

  /** Disables the tooltip. */
  readonly tooltipDisabled = input(false, { transform: booleanAttribute });

  /**
   * Delay before showing (ms). The default keeps a pointer that only passes over the host
   * from flashing a tooltip. Negative or non-numeric means none.
   */
  readonly showDelay = input(150, { transform: numberAttribute });

  /**
   * Delay before hiding (ms). The default gives the pointer time to reach the tooltip,
   * keeping it hoverable per WCAG 1.4.13. Negative or non-numeric means none.
   */
  readonly hideDelay = input(100, { transform: numberAttribute });

  /** Show only when the host text is truncated (ellipsis). */
  readonly showOnEllipsis = input(false, { transform: booleanAttribute });

  // `numberAttribute` passes NaN and negatives through, and both reach setTimeout as
  // nonsense, so normalise before either is read.
  private readonly safeShowDelay = computed(() => clampDelay(this.showDelay()));
  private readonly safeHideDelay = computed(() => clampDelay(this.hideDelay()));

  private readonly id = `lib-tooltip-${nextTooltipId++}`;

  /**
   * The consumer's own `aria-describedby`, read once before the host binding takes the
   * attribute over. The tooltip adds to that description rather than replacing it.
   */
  private readonly consumerDescribedBy = this.elementRef.nativeElement
    .getAttribute('aria-describedby')
    ?.trim();

  /** Set to the tooltip's id while it is on screen. */
  private readonly visibleId = signal<string | null>(null);

  protected readonly describedBy = computed(
    () =>
      [this.consumerDescribedBy, this.visibleId()]
        .filter((value): value is string => !!value)
        .join(' ') || null,
  );

  // CDK overlay refs and DOM timers are inherently imperative state.
  private overlayRef: OverlayRef | null = null;
  private overlayComponentRef: ComponentRef<TooltipOverlay> | null = null;
  private positionSubscription: Subscription | null = null;
  private showTimer: ReturnType<typeof setTimeout> | null = null;
  private hideTimer: ReturnType<typeof setTimeout> | null = null;
  private pointerInHost = false;
  private pointerInOverlay = false;
  private focusInHost = false;
  private leaving = false;

  constructor() {
    // A tooltip disabled while showing must not linger on screen.
    effect(() => {
      if (this.tooltipDisabled()) {
        this.hide();
      }
    });
  }

  ngOnDestroy(): void {
    this.clearShowTimer();
    this.clearHideTimer();
    this.disposeOverlay();
  }

  protected onPointerEnter(): void {
    this.pointerInHost = true;
    this.scheduleShow();
  }

  protected onPointerLeave(): void {
    this.pointerInHost = false;
    this.scheduleHide();
  }

  protected onFocusIn(): void {
    this.focusInHost = true;
    this.scheduleShow();
  }

  /**
   * Focus moving between the host's own descendants still fires `focusout` on it, so
   * containment is checked rather than treating every move as a blur.
   */
  protected onFocusOut(event: FocusEvent): void {
    const next = event.relatedTarget;
    if (next instanceof Node && this.elementRef.nativeElement.contains(next)) {
      return;
    }
    this.focusInHost = false;
    this.scheduleHide();
  }

  /**
   * Activating the host makes the advisory text moot, and a click leaves focus there —
   * which would otherwise pin the tooltip open until focus moved away.
   */
  protected onHostClick(): void {
    this.hide();
  }

  /**
   * WCAG 1.4.13 wants dismissal **without moving pointer or focus**, and a hover-shown
   * tooltip has neither on the host, so a host-level `keydown` never sees the key — the
   * document is the only way to reach it. Capture phase, so Escape is consumed before an
   * enclosing dialog sees it; installed on show only, so it is swallowed only when there
   * is something to dismiss.
   */
  private readonly onDocumentEscape = (event: KeyboardEvent): void => {
    // The pane stays mounted through its exit, and swallowing Escape for one already
    // leaving would keep it from an enclosing dialog.
    if (event.key !== 'Escape' || this.leaving || !this.overlayRef?.hasAttached()) {
      return;
    }
    event.stopPropagation();
    this.hide();
  };

  private scheduleShow(): void {
    this.clearHideTimer();

    if ((this.overlayRef?.hasAttached() && !this.leaving) || this.showTimer) {
      return;
    }

    const delay = this.safeShowDelay();
    if (delay > 0) {
      this.showTimer = setTimeout(() => {
        this.showTimer = null;
        this.show();
      }, delay);
      return;
    }

    this.show();
  }

  private scheduleHide(): void {
    this.clearShowTimer();

    if (this.pointerInHost || this.pointerInOverlay || this.focusInHost) {
      return;
    }

    this.clearHideTimer();

    const delay = this.safeHideDelay();
    if (delay > 0) {
      this.hideTimer = setTimeout(() => {
        this.hide();
      }, delay);
      return;
    }

    this.hide();
  }

  private canShow(): boolean {
    if (this.tooltipDisabled() || !this.libTooltip()) {
      return false;
    }

    if (this.showOnEllipsis() && !this.isEllipsisActive()) {
      return false;
    }

    return true;
  }

  /** Whether the host text overflows its box (`text-overflow: ellipsis`). */
  private isEllipsisActive(): boolean {
    const element = this.elementRef.nativeElement;
    return element.scrollWidth > element.clientWidth || element.scrollHeight > element.clientHeight;
  }

  private show(): void {
    if (!this.canShow()) {
      return;
    }

    if (this.overlayRef?.hasAttached()) {
      if (!this.leaving) {
        return;
      }
      // Re-triggered mid-exit: cut the leave short and enter fresh.
      this.disposeOverlay();
    }

    // Built per show so inputs are fresh; tooltips are too short-lived to cache.
    const positionStrategy = this.overlay
      .position()
      .flexibleConnectedTo(this.elementRef)
      .withPositions(buildTooltipPositions(this.tooltipPosition()))
      .withFlexibleDimensions(false)
      .withPush(true);

    if (activeTooltip !== this) {
      activeTooltip?.hideImmediately();
      // Not a `self = this` alias — registering in the module-level
      // single-visible-tooltip slot.
      // oxlint-disable-next-line @typescript-eslint/no-this-alias
      activeTooltip = this;
    }

    this.overlayRef = this.overlay.create({
      positionStrategy,
      scrollStrategy: this.overlay.scrollStrategies.reposition(),
    });

    const componentRef = this.overlayRef.attach(new ComponentPortal(TooltipOverlay));
    componentRef.setInput('id', this.id);
    componentRef.setInput('position', this.tooltipPosition());

    const content = this.libTooltip();
    if (content instanceof TemplateRef) {
      componentRef.setInput('template', content);
    } else {
      componentRef.setInput('content', content);
    }
    this.overlayComponentRef = componentRef;

    // Keep the transform-origin on the side the overlay actually landed on after a flip.
    this.positionSubscription = positionStrategy.positionChanges.subscribe((change) => {
      this.overlayComponentRef?.setInput('position', resolveTooltipPosition(change.connectionPair));
    });

    // Entering the tooltip cancels the pending hide; listeners go with the pane.
    const pane = this.overlayRef.overlayElement;
    pane.addEventListener('mouseenter', this.onOverlayPointerEnter);
    pane.addEventListener('mouseleave', this.onOverlayPointerLeave);

    this.document.addEventListener('keydown', this.onDocumentEscape, true);

    this.visibleId.set(this.id);
  }

  private hide(): void {
    this.clearShowTimer();
    this.clearHideTimer();
    this.pointerInOverlay = false;
    this.visibleId.set(null);

    const componentRef = this.overlayComponentRef;
    const overlayRef = this.overlayRef;
    if (!componentRef || !overlayRef?.hasAttached() || this.leaving) {
      if (!this.leaving) {
        this.disposeOverlay();
      }
      return;
    }

    // Leave animation, then teardown — unless a re-show already replaced it.
    this.leaving = true;
    void componentRef.instance.animateOut().then(() => {
      if (this.overlayRef === overlayRef) {
        this.disposeOverlay();
      } else {
        overlayRef.dispose();
      }
    });
  }

  /** Tears down without the leave animation — used when superseded. */
  private hideImmediately(): void {
    this.clearShowTimer();
    this.clearHideTimer();
    this.pointerInOverlay = false;
    this.visibleId.set(null);
    this.disposeOverlay();
  }

  private disposeOverlay(): void {
    this.document.removeEventListener('keydown', this.onDocumentEscape, true);
    this.positionSubscription?.unsubscribe();
    this.positionSubscription = null;
    this.overlayComponentRef = null;
    this.overlayRef?.dispose();
    this.overlayRef = null;
    this.leaving = false;
    if (activeTooltip === this) {
      activeTooltip = null;
    }
  }

  private clearShowTimer(): void {
    if (this.showTimer) {
      clearTimeout(this.showTimer);
      this.showTimer = null;
    }
  }

  private clearHideTimer(): void {
    if (this.hideTimer) {
      clearTimeout(this.hideTimer);
      this.hideTimer = null;
    }
  }

  private readonly onOverlayPointerEnter = (): void => {
    this.pointerInOverlay = true;
    this.clearHideTimer();
  };

  private readonly onOverlayPointerLeave = (): void => {
    this.pointerInOverlay = false;
    this.scheduleHide();
  };
}
