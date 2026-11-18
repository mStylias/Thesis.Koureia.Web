import { FlexibleConnectedPositionStrategy, Overlay, OverlayRef } from '@angular/cdk/overlay';
import { ComponentPortal, TemplatePortal } from '@angular/cdk/portal';
import { ComponentRef, ElementRef, inject, Service, Type } from '@angular/core';
import { PopoverRef } from './popover-ref';
import {
  PopoverAnchor,
  PopoverBaseConfig,
  PopoverComponentConfig,
  PopoverConfig,
} from './popover.types';

/** An open component-rendered popover: its handle and the instance. */
export interface PopoverComponentRef<T> {
  /** Controls the popover (close, re-anchor, position). */
  readonly ref: PopoverRef;
  /** The rendered component, for setting inputs and reading state. */
  readonly componentRef: ComponentRef<T>;
}

/**
 * Headless popover primitive: renders a template in a CDK overlay anchored to an element or
 * a viewport point. It owns positioning with flips, dismissal (outside pointerdown, Escape,
 * optional close-on-scroll) and an exit-animation hook; the panel and its styling are the
 * consumer's.
 *
 * ```ts
 * private readonly popover = inject(PopoverService);
 *
 * const ref = this.popover.open({
 *   anchor: { x: event.clientX, y: event.clientY },
 *   template: this.panelTemplate(),
 *   viewContainerRef: this.viewContainerRef,
 *   positions: [{ originX: 'start', originY: 'top',
 *                 overlayX: 'start', overlayY: 'top' }],
 *   onClose: (reason) => this.closed.emit(reason),
 * });
 * ```
 */
@Service()
export class PopoverService {
  private readonly overlay = inject(Overlay);

  /** Opens a template popover and returns the handle controlling it. */
  open<C>(config: PopoverConfig<C>): PopoverRef {
    const { overlayRef, positionStrategy } = this.createOverlay(config);
    overlayRef.attach(new TemplatePortal(config.template, config.viewContainerRef, config.context));
    return new PopoverRef(overlayRef, positionStrategy, config);
  }

  /**
   * Opens a popover rendering `component`, returning the handle and the instance so the
   * caller can set inputs and drive an exit animation.
   */
  openComponent<T>(component: Type<T>, config: PopoverComponentConfig): PopoverComponentRef<T> {
    const { overlayRef, positionStrategy } = this.createOverlay(config);
    const componentRef = overlayRef.attach(
      new ComponentPortal(component, config.viewContainerRef ?? null, config.injector ?? null),
    );
    return {
      ref: new PopoverRef(overlayRef, positionStrategy, config),
      componentRef,
    };
  }

  private createOverlay(config: PopoverBaseConfig): {
    overlayRef: OverlayRef;
    positionStrategy: FlexibleConnectedPositionStrategy;
  } {
    const positionStrategy = this.overlay
      .position()
      .flexibleConnectedTo(config.anchor)
      .withPositions([...config.positions])
      .withFlexibleDimensions(false)
      .withViewportMargin(8)
      .withPush(true);

    // A modal dialog makes everything outside it inert, the overlay container included, so a
    // calendar opened from inside one rendered but took no click. There the pane is a native
    // popover inside the dialog: top layer, and not inert.
    const dialog = modalDialogOf(config.anchor);
    if (dialog !== null) positionStrategy.withPopoverLocation({ type: 'parent', element: dialog });

    const overlayRef = this.overlay.create({
      positionStrategy,
      usePopover: dialog !== null,
      panelClass: config.panelClass,
      disposeOnNavigation: true,
      scrollStrategy:
        config.scrollBehavior === 'close'
          ? this.overlay.scrollStrategies.close()
          : this.overlay.scrollStrategies.reposition(),
    });

    return { overlayRef, positionStrategy };
  }
}

/** The open modal `<dialog>` an element anchor sits in, or `null`. A point anchor has none. */
function modalDialogOf(anchor: PopoverAnchor): HTMLDialogElement | null {
  const element =
    anchor instanceof ElementRef ? (anchor.nativeElement as unknown) : (anchor as unknown);
  if (!(element instanceof Element)) return null;
  const dialog = element.closest('dialog');
  if (!dialog?.open) return null;
  try {
    return dialog.matches(':modal') ? dialog : null;
  } catch {
    // An engine without `:modal` (jsdom): only a modal dialog blocks the page, so assume it.
    return dialog;
  }
}
