import {
  ConnectionPositionPair,
  FlexibleConnectedPositionStrategy,
  OverlayRef,
} from '@angular/cdk/overlay';
import { Signal, signal } from '@angular/core';
import { Subscription } from 'rxjs';
import { PopoverAnchor, PopoverBaseConfig, PopoverCloseReason } from './popover.types';

/**
 * Handle to an open popover. Created by `PopoverService.open()`;
 * consumers close it, move its anchor, or read where it landed.
 */
export class PopoverRef {
  private readonly landedPosition = signal<ConnectionPositionPair | null>(null);
  private readonly subscriptions = new Subscription();
  private closing = false;
  private disposed = false;

  /**
   * The position the overlay actually took after viewport flips —
   * lets consumers keep `transform-origin` on the anchored side.
   */
  readonly position: Signal<ConnectionPositionPair | null> = this.landedPosition.asReadonly();

  constructor(
    private readonly overlayRef: OverlayRef,
    private readonly positionStrategy: FlexibleConnectedPositionStrategy,
    private readonly config: PopoverBaseConfig,
  ) {
    this.subscriptions.add(
      positionStrategy.positionChanges.subscribe((change) => {
        this.landedPosition.set(change.connectionPair);
      }),
    );

    if (config.dismissOnOutsidePointer !== false) {
      this.subscriptions.add(
        overlayRef.outsidePointerEvents().subscribe((event) => {
          if (this.ownsPopupAt(event.target)) {
            return;
          }
          void this.close('outside');
        }),
      );
    }

    if (config.dismissOnEscape !== false) {
      // Capture phase so the popover wins even when content inside the
      // pane (e.g. an aria menu pattern) stops propagation of Escape.
      overlayRef.overlayElement.addEventListener('keydown', this.onKeydownCapture, true);
    }

    // The close scroll strategy detaches the overlay itself; treat it
    // as a dismissal so `onClose` still fires exactly once.
    this.subscriptions.add(
      overlayRef.detachments().subscribe(() => {
        if (!this.closing) {
          this.closing = true;
          try {
            this.config.onClose?.('scroll');
          } finally {
            this.dispose();
          }
        }
      }),
    );
  }

  /** The `cdk-overlay-pane` element hosting the popover content. */
  get overlayElement(): HTMLElement {
    return this.overlayRef.overlayElement;
  }

  /** Whether the popover has started closing. */
  get closed(): boolean {
    return this.closing;
  }

  /** Moves the popover to a new anchor without re-creating it. */
  updateAnchor(anchor: PopoverAnchor): void {
    this.positionStrategy.setOrigin(anchor);
    this.overlayRef.updatePosition();
  }

  /**
   * Re-runs positioning against the pane's current size — needed when
   * content renders or grows after the overlay attached (e.g. deferred
   * content), since flips are decided from the size at attach time.
   */
  updatePosition(): void {
    this.overlayRef.updatePosition();
  }

  /**
   * Closes the popover: notifies `onClose`, awaits `beforeDispose`
   * (exit animation), then tears the overlay down. Safe to call more
   * than once.
   *
   * Teardown is guaranteed: a throwing `onClose` or a rejecting
   * `beforeDispose` still disposes the overlay before the error
   * propagates, so a failed exit animation can never strand the pane on
   * screen with `closing` latched.
   */
  async close(reason: PopoverCloseReason = 'programmatic'): Promise<void> {
    if (this.closing) {
      return;
    }
    this.closing = true;
    try {
      this.config.onClose?.(reason);
      await this.config.beforeDispose?.();
    } finally {
      this.dispose();
    }
  }

  /**
   * Immediate teardown without animation. Idempotent — `overlayElement`
   * is null once the overlay is gone, so an unguarded second call used
   * to throw `Cannot read properties of null`. That is easy to hit when
   * an exit animation is involved: disposing the outgoing pane on reopen
   * races the `finally { dispose() }` inside the pending `close()`.
   */
  dispose(): void {
    if (this.disposed) {
      return;
    }
    this.disposed = true;
    this.closing = true;
    this.overlayRef.overlayElement.removeEventListener('keydown', this.onKeydownCapture, true);
    this.subscriptions.unsubscribe();
    this.overlayRef.dispose();
  }

  /**
   * Whether a pointer that landed outside the pane still belongs to it.
   *
   * A control inside a popover can open an overlay of its own — a date
   * picker's calendar, a select's list, a menu. CDK puts that pane beside ours
   * in the overlay container rather than inside it, so every pointer in it
   * reads as outside and the popover dismisses.
   *
   * That also swallows the interaction. CDK listens for `click` on the body in
   * the **capture** phase, so it dismisses before the event reaches the control
   * that was clicked, and the control is gone by the time bubbling would have
   * run its handler. The user sees the popover vanish with nothing recorded.
   *
   * The link back is the one the control already publishes for assistive
   * technology. A trigger names the popup it owns through `aria-controls`, so
   * a pointer inside an element our pane declares it controls is inside.
   *
   * Read from the DOM at event time rather than tracked: the popup is
   * transient, and only the control knows when it exists.
   */
  private ownsPopupAt(target: EventTarget | null): boolean {
    const ids = new Set<string>();
    for (
      let node = target instanceof Element ? target : null;
      node != null;
      node = node.parentElement
    ) {
      if (node.id !== '') {
        ids.add(node.id);
      }
    }
    if (ids.size === 0) {
      return false;
    }
    // Compared token by token rather than through an attribute selector: both
    // are ID lists, and an id is not safe to interpolate into a selector.
    const owners = this.overlayRef.overlayElement.querySelectorAll('[aria-controls], [aria-owns]');
    for (const owner of owners) {
      const declared = `${owner.getAttribute('aria-controls') ?? ''} ${owner.getAttribute('aria-owns') ?? ''}`;
      for (const id of declared.split(/\s+/)) {
        if (id !== '' && ids.has(id)) {
          return true;
        }
      }
    }
    return false;
  }

  private readonly onKeydownCapture = (event: KeyboardEvent): void => {
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      void this.close('escape');
    }
  };
}
