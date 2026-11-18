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
  signal,
  viewChild,
} from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { UiCopyPipe } from '@util/ui-copy';
import { Toast } from './toast';
import {
  TOAST_GAP,
  TOAST_LIFETIME,
  TOAST_MOBILE_OFFSET,
  TOAST_VIEWPORT_OFFSET,
  TOAST_VISIBLE_AMOUNT,
  TOAST_WIDTH,
} from './toaster.constants';
import { TOASTER_TRANSLOCO_SCOPE } from './toaster.i18n';
import { ToasterService } from './toaster.service';
import { ToastHeight, ToasterPosition } from './toaster.types';

/**
 * Design-system toaster, a sonner port. Place once in the app shell; it renders the stack
 * for every toast fired through `ToasterService`.
 *
 * ```ts
 * import { Toaster } from '@ui/toaster';
 * ```
 *
 * ```html
 * <lib-toaster position="bottom-right" />
 * ```
 */
@Component({
  selector: 'lib-toaster',
  templateUrl: './toaster.html',
  styleUrl: './toaster.scss',
  imports: [Toast, TranslocoPipe, UiCopyPipe],
  providers: [TOASTER_TRANSLOCO_SCOPE],
})
export class Toaster {
  private readonly toaster = inject(ToasterService);
  private readonly elementRef = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly destroyRef = inject(DestroyRef);
  private readonly document = inject(DOCUMENT);

  /** Screen corner the stack anchors to. Defaults to `bottom-right`. */
  readonly position = input<ToasterPosition>('bottom-right');
  /** Auto-dismiss delay in ms for toasts that don't set their own. */
  readonly life = input(TOAST_LIFETIME, { transform: numberAttribute });
  /** How many toasts stay on screen before the rest collapse behind them. */
  readonly visibleToasts = input(TOAST_VISIBLE_AMOUNT, {
    transform: numberAttribute,
  });
  /** Vertical spacing in px between stacked toasts. */
  readonly gap = input(TOAST_GAP, { transform: numberAttribute });
  /** When true, sticky toasts show a close button. Auto-dismiss toasts never show one. */
  readonly closeButton = input(true, { transform: booleanAttribute });
  /** Keeps the stack always expanded instead of collapsing behind the front toast. */
  readonly expand = input(false, { transform: booleanAttribute });
  /** Accessible name for the stack; falls back to the lib's scope. */
  readonly ariaLabel = input('');
  /** Accessible name for each toast's close button; falls back to the scope. */
  readonly closeAriaLabel = input('');

  private readonly listRef = viewChild<ElementRef<HTMLElement>>('list');

  protected readonly expanded = signal(false);
  protected readonly hovered = signal(false);
  protected readonly focused = signal(false);
  protected readonly interacting = signal(false);
  protected readonly toasts = this.toaster.toasts;
  protected readonly heights = signal<readonly ToastHeight[]>([]);

  /**
   * Where focus goes when the toast holding it leaves and no other can take it: whatever
   * had it before the user moved into the stack. A plain field — bookkeeping, never rendered.
   */
  private returnFocusTarget: HTMLElement | null = null;

  protected readonly width = TOAST_WIDTH;
  protected readonly viewportOffset = TOAST_VIEWPORT_OFFSET;
  protected readonly mobileOffset = TOAST_MOBILE_OFFSET;

  protected readonly yPosition = computed(() => this.position().split('-')[0] as 'top' | 'bottom');
  protected readonly xPosition = computed(
    () => this.position().split('-')[1] as 'left' | 'center' | 'right',
  );

  protected readonly orderedHeights = computed(() =>
    this.orderHeightsByToastStack(this.heights(), this.toasts()),
  );

  protected readonly frontToastHeight = computed(() => {
    const frontId = this.toasts()[0]?.id;
    if (!frontId) {
      return 0;
    }

    const frontHeight =
      this.orderedHeights().find((entry) => entry.toastId === frontId)?.height ?? 0;
    if (frontHeight > 0) {
      return frontHeight;
    }

    return this.orderedHeights().reduce((max, entry) => Math.max(max, entry.height), 0);
  });

  constructor() {
    effect(() => {
      this.toaster.defaultLife.set(this.life());
    });

    effect(() => {
      if (this.expand()) {
        this.expanded.set(true);
        return;
      }

      if (this.toasts().length <= 1) {
        this.expanded.set(false);
      }
    });

    effect(() => {
      if (this.toasts().length) {
        return;
      }

      // The `<ol>` unmounts with the last toast, so a pointer or focus on it never gets
      // its `mouseleave`/`focusout` — and the flags it set would pause the next toast forever.
      this.hovered.set(false);
      this.focused.set(false);
      this.interacting.set(false);
    });

    // Escape the shell's stacking contexts; the stack must overlay the whole viewport.
    afterNextRender(() => {
      this.document.body.appendChild(this.elementRef.nativeElement);

      this.destroyRef.onDestroy(() => {
        this.elementRef.nativeElement.remove();
      });
    });
  }

  protected onMouseEnter(): void {
    this.hovered.set(true);
    this.expanded.set(true);
  }

  protected onMouseMove(): void {
    this.hovered.set(true);
    this.expanded.set(true);
  }

  protected onMouseLeave(): void {
    this.hovered.set(false);
    if (!this.interacting() && !this.expand()) {
      this.expanded.set(false);
    }
  }

  /**
   * Focus pauses auto-dismiss as hover does, or a toast vanishes from under the person
   * reading it and takes their focus point with it. `focusin`'s `relatedTarget` is the only
   * chance to learn where to send focus back.
   */
  protected onFocusIn(event: FocusEvent): void {
    const previous = event.relatedTarget;
    if (previous instanceof HTMLElement && !this.listContains(previous)) {
      this.returnFocusTarget = previous;
    }

    this.focused.set(true);
  }

  protected onFocusOut(event: FocusEvent): void {
    // Focus moving between a toast and its own buttons is not a blur.
    const next = event.relatedTarget;
    if (next instanceof HTMLElement && this.listContains(next)) {
      return;
    }

    this.focused.set(false);
  }

  protected onPointerDown(): void {
    this.interacting.set(true);
  }

  protected onPointerUp(): void {
    this.interacting.set(false);
  }

  protected onDragEnd(): void {
    this.expanded.set(false);
  }

  protected registerHeight(entry: ToastHeight): void {
    this.heights.update((current) => {
      if (current.some((item) => item.toastId === entry.toastId)) {
        return current;
      }

      return this.orderHeightsByToastStack([...current, entry], this.toasts());
    });
  }

  protected updateHeight(entry: ToastHeight): void {
    this.heights.update((current) => {
      const exists = current.some((item) => item.toastId === entry.toastId);
      const next = exists
        ? current.map((item) => (item.toastId === entry.toastId ? entry : item))
        : [...current, entry];

      return this.orderHeightsByToastStack(next, this.toasts());
    });
  }

  protected removeHeight(id: string): void {
    this.heights.update((current) => current.filter((item) => item.toastId !== id));
  }

  protected removeToast(id: string): void {
    this.toaster.remove(id);

    // A toast destroyed while holding focus (a consumer's own `remove()`) fires no
    // `focusout`; the browser just reverts to `<body>`. So re-derive the flag, don't trust it.
    const active = this.document.activeElement;
    this.focused.set(active instanceof HTMLElement && this.listContains(active));
  }

  /**
   * A dismissed toast takes focus with it, and focus on `<body>` is a lost place in the
   * page. The next toast on screen is the closest equivalent; with none, focus goes back.
   */
  protected onToastDismissed(): void {
    const list = this.listRef()?.nativeElement;
    const active = this.document.activeElement;
    if (!list || !(active instanceof HTMLElement) || !list.contains(active)) {
      return;
    }

    const toasts = [...list.querySelectorAll<HTMLElement>('li[lib-toast]')];
    const index = toasts.findIndex((toast) => toast.contains(active));
    // Newest first, so the toast below is next in the stack and those above are fallback.
    const candidates = [
      ...toasts.slice(index + 1),
      ...toasts.slice(0, Math.max(index, 0)).reverse(),
    ];
    const next = candidates.find(
      (toast) => toast.dataset['visible'] === 'true' && toast.dataset['removed'] !== 'true',
    );

    if (next) {
      next.focus();
      return;
    }

    if (this.returnFocusTarget?.isConnected) {
      this.returnFocusTarget.focus();
    }
  }

  private listContains(element: HTMLElement): boolean {
    return this.listRef()?.nativeElement.contains(element) ?? false;
  }

  private orderHeightsByToastStack(
    heights: readonly ToastHeight[],
    toasts: readonly { id: string }[],
  ): ToastHeight[] {
    const order = new Map(toasts.map((toast, index) => [toast.id, index]));

    return [...heights]
      .filter((entry) => order.has(entry.toastId))
      .sort((left, right) => (order.get(left.toastId) ?? 0) - (order.get(right.toastId) ?? 0));
  }
}
