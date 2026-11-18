import { ConnectedPosition } from '@angular/cdk/overlay';
import {
  afterNextRender,
  booleanAttribute,
  ComponentRef,
  computed,
  Directive,
  effect,
  ElementRef,
  inject,
  Injector,
  input,
  OnDestroy,
  signal,
  TemplateRef,
} from '@angular/core';
import { PopoverRef } from './popover-ref';
import { PopoverSurface, PopoverSurfacePosition } from './popover-surface';
import { PopoverService } from './popover.service';

let nextPopoverId = 0;

/** Preferred side the panel opens on, relative to the trigger. */
export type PopoverTriggerPosition = 'bottom' | 'top';

const POSITIONS: Record<PopoverTriggerPosition, ConnectedPosition[]> = {
  bottom: [
    { originX: 'start', originY: 'bottom', overlayX: 'start', overlayY: 'top', offsetY: 6 },
    { originX: 'start', originY: 'top', overlayX: 'start', overlayY: 'bottom', offsetY: -6 },
    { originX: 'end', originY: 'bottom', overlayX: 'end', overlayY: 'top', offsetY: 6 },
    { originX: 'end', originY: 'top', overlayX: 'end', overlayY: 'bottom', offsetY: -6 },
  ],
  top: [
    { originX: 'start', originY: 'top', overlayX: 'start', overlayY: 'bottom', offsetY: -6 },
    { originX: 'start', originY: 'bottom', overlayX: 'start', overlayY: 'top', offsetY: 6 },
    { originX: 'end', originY: 'top', overlayX: 'end', overlayY: 'bottom', offsetY: -6 },
    { originX: 'end', originY: 'bottom', overlayX: 'end', overlayY: 'top', offsetY: 6 },
  ],
};

/**
 * Opens a popover, an element-anchored overlay holding arbitrary content, from the host:
 *
 * ```html
 * <button libButton [libPopoverTriggerFor]="details">Details</button>
 * <ng-template #details>
 *   <p>Any content…</p>
 * </ng-template>
 * ```
 *
 * The trigger toggles it; it closes on outside pointerdown, Escape (restoring focus) and
 * scroll. The surface is `role="dialog"` and takes focus on open; the trigger carries
 * `aria-haspopup`, `aria-expanded` and `aria-controls`. One trigger owns one popover —
 * re-anchoring to different targets lives on `PopoverService`.
 */
@Directive({
  selector: '[libPopoverTriggerFor]',
  exportAs: 'libPopoverTrigger',
  host: {
    // A disabled trigger advertises no popup: announcing a dialog nobody can open is a
    // disabled state that does not disable.
    '[attr.aria-haspopup]': 'popoverDisabled() ? null : "dialog"',
    '[attr.aria-expanded]': 'popoverDisabled() ? null : isOpen()',
    '[attr.aria-controls]': 'isOpen() ? panelId : null',
    '[attr.id]': 'triggerId',
    '(pointerdown)': 'onPointerDown()',
    '(click)': 'onClick()',
  },
})
export class PopoverTrigger implements OnDestroy {
  private readonly popover = inject(PopoverService);
  private readonly injector = inject(Injector);
  private readonly elementRef = inject<ElementRef<HTMLElement>>(ElementRef);

  /** Content template rendered inside the popover surface. */
  readonly libPopoverTriggerFor = input.required<TemplateRef<unknown>>();

  /** Preferred side; flips when it does not fit. Defaults to `bottom`. */
  readonly popoverPosition = input<PopoverTriggerPosition>('bottom');

  /** Accessible name of the surface. Without it, the trigger names it. */
  readonly popoverAriaLabel = input('');

  /** Id of an element that labels the dialog surface. */
  readonly popoverAriaLabelledby = input('');

  /** Disables the trigger without removing it. */
  readonly popoverDisabled = input(false, { transform: booleanAttribute });

  protected readonly panelId = `lib-popover-${nextPopoverId++}`;

  /**
   * The trigger's id, so it can name the surface — an unnamed `role="dialog"` fails AXE,
   * and what the user just activated is the right fallback. A supplied id passes through.
   */
  protected readonly triggerId =
    this.elementRef.nativeElement.id || `lib-popover-trigger-${nextPopoverId++}`;

  /** `aria-labelledby` wins over `aria-label`, so an explicit label must clear it. */
  protected readonly surfaceLabelledby = computed(() =>
    this.popoverAriaLabel() ? '' : this.popoverAriaLabelledby() || this.triggerId,
  );

  protected readonly isOpen = signal(false);

  // Signal-backed, not a plain field: the effect below reads `position()` off it and would
  // otherwise have no dependency — running once against a null ref and never again, leaving
  // transform-origin stuck on the default side after a flip.
  private readonly popoverRef = signal<PopoverRef | null>(null);
  private surfaceRef: ComponentRef<PopoverSurface> | null = null;

  // Whether it was open when the pointer went down. Clicking an open trigger fires the
  // overlay's outside-dismiss first, so without the snapshot this handler sees a closed
  // popover and reopens it.
  private wasOpenOnPointerDown = false;

  constructor() {
    // Keep transform-origin on the side the surface actually landed on after a flip.
    effect(() => {
      const pair = this.popoverRef()?.position();
      if (pair && this.surfaceRef) {
        const position: PopoverSurfacePosition = pair.overlayY === 'bottom' ? 'top' : 'bottom';
        this.surfaceRef.setInput('position', position);
      }
    });

    // The name comes from inputs that can change while open, so push rather than snapshot.
    effect(() => {
      const surface = this.surfaceRef;
      const labelledby = this.surfaceLabelledby();
      if (this.popoverRef() && surface) {
        surface.setInput('ariaLabel', this.popoverAriaLabel());
        surface.setInput('ariaLabelledby', labelledby);
      }
    });
  }

  ngOnDestroy(): void {
    this.popoverRef()?.dispose();
    this.popoverRef.set(null);
  }

  protected onPointerDown(): void {
    this.wasOpenOnPointerDown = this.isOpen();
  }

  protected onClick(): void {
    const wasOpen = this.wasOpenOnPointerDown;
    this.wasOpenOnPointerDown = false;
    if (wasOpen) {
      this.hide();
    } else {
      this.show();
    }
  }

  /** Opens the popover if closed, closes it if open. */
  toggle(): void {
    if (this.popoverRef()) {
      this.hide();
    } else {
      this.show();
    }
  }

  /** Opens the popover. */
  show(): void {
    if (this.popoverRef() || this.popoverDisabled()) {
      return;
    }

    const { ref, componentRef } = this.popover.openComponent(PopoverSurface, {
      anchor: this.elementRef,
      positions: POSITIONS[this.popoverPosition()],
      scrollBehavior: 'reposition',
      injector: this.injector,
      beforeDispose: () => this.surfaceRef?.instance.animateOut() ?? Promise.resolve(),
      onClose: (reason) => {
        this.popoverRef.set(null);
        this.surfaceRef = null;
        this.isOpen.set(false);
        if (reason === 'escape' || reason === 'programmatic') {
          this.elementRef.nativeElement.focus();
        }
      },
    });

    this.surfaceRef = componentRef;
    componentRef.setInput('id', this.panelId);
    componentRef.setInput('content', this.libPopoverTriggerFor());
    componentRef.setInput('ariaLabel', this.popoverAriaLabel());
    componentRef.setInput('ariaLabelledby', this.surfaceLabelledby());
    this.popoverRef.set(ref);
    this.isOpen.set(true);

    // Move focus into the dialog once its content has rendered.
    afterNextRender(
      () => {
        this.focusSurface();
      },
      { injector: this.injector },
    );
  }

  /** Closes the popover and restores focus to the trigger. */
  hide(): void {
    void this.popoverRef()?.close();
  }

  private focusSurface(): void {
    const dialog = this.surfaceRef?.instance.dialogElement;
    if (!dialog) {
      return;
    }
    const focusable = dialog.querySelector<HTMLElement>(
      'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
    );
    (focusable ?? dialog).focus();
  }
}
