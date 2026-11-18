import {
  afterNextRender,
  booleanAttribute,
  Component,
  computed,
  DestroyRef,
  DOCUMENT,
  effect,
  ElementRef,
  inject,
  input,
  numberAttribute,
  output,
  signal,
  untracked,
} from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { UiCopyPipe } from '@util/ui-copy';
import {
  LucideBell,
  LucideCircleCheck,
  LucideCircleX,
  LucideInfo,
  LucideLoaderCircle,
  LucideSparkles,
  LucideTriangleAlert,
  LucideX,
} from '@lucide/angular';
import {
  getDefaultSwipeDirections,
  SwipeDirection,
  ToastData,
  ToastHeight,
  ToasterPosition,
} from './toaster.types';
import { TOAST_LIFETIME, TOAST_SWIPE_THRESHOLD, TOAST_UNMOUNT_DELAY } from './toaster.constants';
import { TOASTER_TRANSLOCO_SCOPE } from './toaster.i18n';

/**
 * A single toast in the stack. Rendered by `<lib-toaster>` — not meant
 * to be used directly. Handles mount/exit animations, swipe-to-dismiss,
 * and the pausable auto-dismiss timer (ported from sonner@2.0.7).
 */
@Component({
  selector: 'lib-toast, li[lib-toast]',
  templateUrl: './toast.html',
  styleUrl: './toast.scss',
  imports: [
    LucideBell,
    LucideCircleCheck,
    LucideCircleX,
    LucideInfo,
    LucideLoaderCircle,
    LucideSparkles,
    LucideTriangleAlert,
    LucideX,
    TranslocoPipe,
    UiCopyPipe,
  ],
  providers: [TOASTER_TRANSLOCO_SCOPE],
  host: {
    // Toasts past `visibleToasts` are faded out and non-interactive, so
    // they leave the tab order too (their buttons do the same).
    '[attr.tabindex]': 'visible() ? 0 : -1',
    '[attr.data-mounted]': 'mounted() ? "true" : "false"',
    '[attr.data-removed]': 'isRemoved() ? "true" : "false"',
    '[attr.data-visible]': 'visible() ? "true" : "false"',
    '[attr.data-front]': 'isFront() ? "true" : "false"',
    '[attr.data-expanded]': 'isExpanded() ? "true" : "false"',
    '[attr.data-swiping]': 'swiping() ? "true" : "false"',
    '[attr.data-swiped]': 'isSwiped() ? "true" : "false"',
    '[attr.data-swipe-out]': 'swipeOut() ? "true" : "false"',
    '[attr.data-swipe-direction]': 'swipeOutDirection()',
    '[attr.data-dismissible]': 'dismissible() ? "true" : "false"',
    '[attr.data-sticky]': 'sticky() ? "true" : "false"',
    '[attr.data-loading]': 'loading() ? "true" : "false"',
    '[attr.data-severity]': 'toast().severity',
    '[attr.data-y-position]': 'yPosition()',
    '[attr.data-x-position]': 'xPosition()',
    '[attr.data-index]': 'index()',
    '[style.--index]': 'index()',
    '[style.--toasts-before]': 'index()',
    '[style.--z-index]': 'zIndex()',
    '[style.--offset]': 'offsetStyle()',
    '[style.--initial-height.px]': 'initialHeight()',
    '[style.--swipe-amount-x]': 'swipeAmountX()',
    '[style.--swipe-amount-y]': 'swipeAmountY()',
    '(pointerdown)': 'onPointerDown($event)',
    '(pointerup)': 'onPointerUp()',
    '(pointermove)': 'onPointerMove($event)',
    '(dragend)': 'onDragEnd()',
  },
})
export class Toast {
  private readonly elementRef = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly destroyRef = inject(DestroyRef);
  private readonly document = inject(DOCUMENT);

  readonly toast = input.required<ToastData>();
  readonly index = input(0, { transform: numberAttribute });
  readonly expanded = input(false, { transform: booleanAttribute });
  /** Whether hover or keyboard focus is actively pausing auto-dismiss. */
  readonly paused = input(false, { transform: booleanAttribute });
  readonly interacting = input(false, { transform: booleanAttribute });
  readonly position = input<ToasterPosition>('bottom-right');
  readonly visibleToasts = input(3, { transform: numberAttribute });
  readonly gap = input(14, { transform: numberAttribute });
  readonly closeButton = input(true, { transform: booleanAttribute });
  readonly expandByDefault = input(false, { transform: booleanAttribute });
  readonly life = input(TOAST_LIFETIME, { transform: numberAttribute });
  readonly heights = input<readonly ToastHeight[]>([]);
  readonly totalToasts = input(0, { transform: numberAttribute });
  /** Accessible name for the close button; falls back to the lib's scope. */
  readonly closeAriaLabel = input('');

  readonly heightRegistered = output<ToastHeight>();
  readonly heightUpdated = output<ToastHeight>();
  readonly heightRemoved = output<string>();
  readonly removed = output<string>();
  /**
   * The toast has started leaving, whatever asked it to. The stack listens so
   * it can move focus off a toast that is about to disappear from under it.
   */
  readonly dismissed = output();

  protected readonly mounted = signal(false);
  protected readonly removedState = signal(false);
  protected readonly swiping = signal(false);
  protected readonly swipeOut = signal(false);
  protected readonly isSwiped = signal(false);
  protected readonly swipeOutDirection = signal<SwipeDirection | null>(null);
  protected readonly swipeDirection = signal<'x' | 'y' | null>(null);
  protected readonly initialHeight = signal(0);
  protected readonly offsetBeforeRemove = signal(0);

  protected readonly swipeAmountX = signal('0px');
  protected readonly swipeAmountY = signal('0px');
  private readonly pointerStart = signal<{ x: number; y: number } | null>(null);
  private readonly dragStartTime = signal<number | null>(null);
  private readonly remainingTime = signal(TOAST_LIFETIME);
  private readonly closeTimerStartTime = signal(0);
  private readonly lastCloseTimerStartTime = signal(0);
  // `document.hidden` mirrored as a signal: the auto-close effect has to
  // reevaluate when the tab is backgrounded, and a bare property read
  // would just leave whatever timer is running to expire unseen.
  private readonly documentHidden = signal(false);
  // Imperative DOM timers — intentionally not signals.
  private autoCloseTimer: ReturnType<typeof setTimeout> | null = null;
  private unmountTimer: ReturnType<typeof setTimeout> | null = null;

  protected readonly sticky = computed(() => this.toast().sticky);
  protected readonly loading = computed(() => this.toast().loading);

  /**
   * Auto-dismiss delay for this toast. A computed rather than a read of
   * `toast()`: patching an unrelated field (a `promise()` resolving, the
   * delete flag) must not restart a countdown that is already running.
   */
  private readonly lifetime = computed(() => this.toast().life || this.life());

  /**
   * `life: 0` means "never auto-dismiss" (what `loading()` toasts are made
   * with), so the gate reads the toast's own delay and not {@link lifetime},
   * which falls back to the toaster's default. A delay that cannot be counted
   * down — `NaN`, `Infinity` — is treated the same way.
   */
  private readonly autoDismissDisabled = computed(() => {
    const life = this.toast().life;
    return !Number.isFinite(life) || life <= 0;
  });

  /** Every reason the countdown is currently held. */
  private readonly halted = computed(
    () => this.paused() || this.interacting() || this.documentHidden(),
  );

  protected readonly isFront = computed(() => this.index() === 0);
  protected readonly visible = computed(() => this.index() + 1 <= this.visibleToasts());
  protected readonly isRemoved = computed(() => this.removedState());
  protected readonly dismissible = computed(() => this.toast().closable);
  protected readonly isExpanded = computed(() => this.expanded() || this.expandByDefault());
  protected readonly yPosition = computed(() => this.position().split('-')[0] as 'top' | 'bottom');
  protected readonly xPosition = computed(
    () => this.position().split('-')[1] as 'left' | 'center' | 'right',
  );
  protected readonly zIndex = computed(() => this.totalToasts() - this.index());

  protected readonly heightIndex = computed(() => {
    const heights = this.heights();
    const index = heights.findIndex((entry) => entry.toastId === this.toast().id);
    return index === -1 ? this.index() : index;
  });

  protected readonly toastsHeightBefore = computed(() => {
    const heights = this.heights();
    const heightIndex = this.heightIndex();

    return heights.reduce((total, entry, reducerIndex) => {
      if (reducerIndex >= heightIndex) {
        return total;
      }

      return total + entry.height;
    }, 0);
  });

  protected readonly stackOffset = computed(
    () => this.heightIndex() * this.gap() + this.toastsHeightBefore(),
  );

  protected readonly offsetStyle = computed(() => {
    const offset = this.isRemoved() ? this.offsetBeforeRemove() : this.stackOffset();
    return `${offset}px`;
  });

  protected readonly showCloseButton = computed(
    () => this.closeButton() && this.sticky() && this.toast().closable && !this.loading(),
  );

  constructor() {
    effect(() => {
      this.remainingTime.set(this.lifetime());
    });

    effect(() => {
      if (this.toast().delete) {
        this.deleteToast();
      }
    });

    effect(() => {
      const sticky = this.sticky();
      const loading = this.loading();
      const disabled = this.autoDismissDisabled();
      const halted = this.halted();

      // The timer bookkeeping both reads and writes `closeTimerStartTime` /
      // `lastCloseTimerStartTime`, which would make this effect retrigger
      // itself for as long as a toast stays paused. Only the state read above
      // is a dependency.
      untracked(() => {
        this.syncAutoCloseTimer(sticky, loading, disabled, halted);
      });
    });

    afterNextRender(() => {
      requestAnimationFrame(() => {
        this.mounted.set(true);
      });

      this.measureAndRegisterHeight();

      const resizeObserver = new ResizeObserver(() => {
        this.updateHeight();
      });

      resizeObserver.observe(this.elementRef.nativeElement);

      // Seeded here as well, so a toast fired into an already-hidden tab
      // starts paused rather than waiting for the next change.
      const syncDocumentHidden = (): void => {
        this.documentHidden.set(this.document.hidden);
      };
      syncDocumentHidden();
      this.document.addEventListener('visibilitychange', syncDocumentHidden);

      this.destroyRef.onDestroy(() => {
        resizeObserver.disconnect();
        this.document.removeEventListener('visibilitychange', syncDocumentHidden);
        this.clearAutoCloseTimer();
        // Nothing may outlive the component: a toast torn down mid-exit
        // otherwise emitted `removed` from a destroyed output (NG0953).
        if (this.unmountTimer) {
          clearTimeout(this.unmountTimer);
          this.unmountTimer = null;
        }
      });
    });
  }

  protected onAction(event: MouseEvent): void {
    event.stopPropagation();
    this.toast().action?.onClick?.(event);
    this.deleteToast();
  }

  protected onClose(event: MouseEvent): void {
    event.stopPropagation();
    if (!this.dismissible()) {
      return;
    }

    this.deleteToast();
  }

  protected onPointerDown(event: PointerEvent): void {
    if (event.button === 2 || !this.dismissible()) {
      return;
    }

    const target = event.target;
    // Not `tagName === 'BUTTON'`: the action and close buttons render a lucide
    // `<svg>` inside, so a press landing on the icon — the middle of the
    // button — used to start a swipe instead of pressing the button.
    if (!(target instanceof Element) || target.closest('button')) {
      return;
    }

    this.dragStartTime.set(Date.now());
    this.offsetBeforeRemove.set(this.stackOffset());
    target.setPointerCapture(event.pointerId);

    this.swiping.set(true);
    this.pointerStart.set({ x: event.clientX, y: event.clientY });
  }

  protected onPointerUp(): void {
    if (this.swipeOut() || !this.dismissible()) {
      return;
    }

    this.pointerStart.set(null);

    const swipeAmountX = Number(this.swipeAmountX().replace('px', '') || 0);
    const swipeAmountY = Number(this.swipeAmountY().replace('px', '') || 0);
    const dragStart = this.dragStartTime();
    const timeTaken = dragStart ? Date.now() - dragStart : 1;
    const direction = this.swipeDirection();
    const swipeAmount = direction === 'x' ? swipeAmountX : swipeAmountY;
    const velocity = Math.abs(swipeAmount) / timeTaken;

    if (Math.abs(swipeAmount) >= TOAST_SWIPE_THRESHOLD || velocity > 0.11) {
      this.offsetBeforeRemove.set(this.stackOffset());

      if (direction === 'x') {
        this.swipeOutDirection.set(swipeAmountX > 0 ? 'right' : 'left');
      } else {
        this.swipeOutDirection.set(swipeAmountY > 0 ? 'down' : 'up');
      }

      this.deleteToast();
      this.swipeOut.set(true);
      return;
    }

    this.swipeAmountX.set('0px');
    this.swipeAmountY.set('0px');
    this.isSwiped.set(false);
    this.swiping.set(false);
    this.swipeDirection.set(null);
  }

  protected onPointerMove(event: PointerEvent): void {
    const start = this.pointerStart();
    if (!start || !this.dismissible()) {
      return;
    }

    if ((this.document.getSelection()?.toString().length ?? 0) > 0) {
      return;
    }

    const yDelta = event.clientY - start.y;
    const xDelta = event.clientX - start.x;
    const swipeDirections = getDefaultSwipeDirections(this.position());
    let direction = this.swipeDirection();

    if (!direction && (Math.abs(xDelta) > 1 || Math.abs(yDelta) > 1)) {
      direction = Math.abs(xDelta) > Math.abs(yDelta) ? 'x' : 'y';
      this.swipeDirection.set(direction);
    }

    let swipeX = 0;
    let swipeY = 0;

    if (direction === 'y') {
      if (swipeDirections.includes('top') || swipeDirections.includes('bottom')) {
        if (
          (swipeDirections.includes('top') && yDelta < 0) ||
          (swipeDirections.includes('bottom') && yDelta > 0)
        ) {
          swipeY = yDelta;
        } else {
          const dampened = yDelta * this.getDampening(yDelta);
          swipeY = Math.abs(dampened) < Math.abs(yDelta) ? dampened : yDelta;
        }
      }
    } else if (direction === 'x') {
      if (swipeDirections.includes('left') || swipeDirections.includes('right')) {
        if (
          (swipeDirections.includes('left') && xDelta < 0) ||
          (swipeDirections.includes('right') && xDelta > 0)
        ) {
          swipeX = xDelta;
        } else {
          const dampened = xDelta * this.getDampening(xDelta);
          swipeX = Math.abs(dampened) < Math.abs(xDelta) ? dampened : xDelta;
        }
      }
    }

    if (Math.abs(swipeX) > 0 || Math.abs(swipeY) > 0) {
      this.isSwiped.set(true);
    }

    this.swipeAmountX.set(`${swipeX}px`);
    this.swipeAmountY.set(`${swipeY}px`);
  }

  protected onDragEnd(): void {
    this.swiping.set(false);
    this.swipeDirection.set(null);
    this.pointerStart.set(null);
  }

  private deleteToast(): void {
    if (this.removedState()) {
      return;
    }

    this.removedState.set(true);
    this.offsetBeforeRemove.set(this.stackOffset());
    this.heightRemoved.emit(this.toast().id);
    // Before the exit animation, not after: whoever holds focus in here is
    // about to lose it, and the stack is the only thing that knows where it
    // should go instead.
    this.dismissed.emit();

    this.unmountTimer = setTimeout(() => {
      this.unmountTimer = null;
      this.removed.emit(this.toast().id);
    }, TOAST_UNMOUNT_DELAY);
  }

  private syncAutoCloseTimer(
    sticky: boolean,
    loading: boolean,
    disabled: boolean,
    halted: boolean,
  ): void {
    if (sticky || disabled || loading) {
      this.clearAutoCloseTimer();
      return;
    }

    if (halted) {
      this.pauseAutoCloseTimer();
      return;
    }

    this.startAutoCloseTimer();
  }

  private startAutoCloseTimer(): void {
    if (this.remainingTime() === Infinity) {
      return;
    }

    this.clearAutoCloseTimer();
    this.closeTimerStartTime.set(Date.now());

    this.autoCloseTimer = setTimeout(() => {
      this.deleteToast();
    }, this.remainingTime());
  }

  private pauseAutoCloseTimer(): void {
    if (this.lastCloseTimerStartTime() < this.closeTimerStartTime()) {
      const elapsed = Date.now() - this.closeTimerStartTime();
      this.remainingTime.update((value) => Math.max(0, value - elapsed));
    }

    this.lastCloseTimerStartTime.set(Date.now());
    this.clearAutoCloseTimer();
  }

  private clearAutoCloseTimer(): void {
    if (this.autoCloseTimer) {
      clearTimeout(this.autoCloseTimer);
      this.autoCloseTimer = null;
    }
  }

  private measureAndRegisterHeight(): void {
    const height = this.elementRef.nativeElement.getBoundingClientRect().height;
    this.initialHeight.set(height);
    this.heightRegistered.emit({
      toastId: this.toast().id,
      height,
      position: this.position(),
    });
  }

  private updateHeight(): void {
    if (!this.mounted()) {
      return;
    }

    const element = this.elementRef.nativeElement;
    const originalHeight = element.style.height;
    element.style.height = 'auto';
    const height = element.getBoundingClientRect().height;
    element.style.height = originalHeight;
    this.initialHeight.set(height);

    this.heightUpdated.emit({
      toastId: this.toast().id,
      height,
      position: this.position(),
    });
  }

  private getDampening(delta: number): number {
    const factor = Math.abs(delta) / 20;
    return 1 / (1.5 + factor);
  }
}
