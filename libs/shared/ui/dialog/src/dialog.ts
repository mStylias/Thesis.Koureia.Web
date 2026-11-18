import { NgTemplateOutlet } from '@angular/common';
import {
  afterNextRender,
  afterRenderEffect,
  booleanAttribute,
  Component,
  computed,
  contentChild,
  DestroyRef,
  Directive,
  DOCUMENT,
  ElementRef,
  inject,
  input,
  model,
  NgZone,
  output,
  signal,
  TemplateRef,
  viewChild,
} from '@angular/core';
import {
  LucideArrowDown,
  LucideArrowDownLeft,
  LucideArrowDownRight,
  LucideArrowLeft,
  LucideArrowRight,
  LucideArrowUp,
  LucideArrowUpLeft,
  LucideArrowUpRight,
  LucideCircleDot,
  LucideMaximize2,
  LucideMinimize2,
  LucideMove,
  LucideX,
} from '@lucide/angular';
import { provideTranslocoScope, TranslocoPipe } from '@jsverse/transloco';
import { UiCopyPipe } from '@util/ui-copy';
import { Button } from '@ui/button';
import { Tooltip } from '@ui/tooltip';
import { DIALOG_CLOSE_DELAY } from './dialog.constants';
import {
  DialogCloseReason,
  DialogClosedEvent,
  DialogDragEndEvent,
  DialogHeadlessContext,
  DialogHeadlessTemplateContext,
  DialogMaxHeight,
  DialogPosition,
  DialogSize,
} from './dialog.types';

let nextDialogId = 0;

/** Marks projected content as the dialog's custom header. */
@Directive({ selector: '[libDialogHeader]' })
export class DialogHeader {}

/** Marks an `ng-template` as the dialog's pinned footer. */
@Directive({ selector: 'ng-template[libDialogFooter]' })
export class DialogFooter {
  readonly templateRef = inject<TemplateRef<unknown>>(TemplateRef);
}

/** Replaces all built-in dialog chrome with a custom template. */
@Directive({ selector: 'ng-template[libDialogHeadless]' })
export class DialogHeadless {
  readonly templateRef = inject<TemplateRef<DialogHeadlessTemplateContext>>(TemplateRef);
}

/**
 * Accessible dialog on the native `<dialog>`. Modal mode uses `showModal()` for platform
 * focus containment and background inertness; non-modal uses `show()` and leaves the page
 * interactive.
 *
 * ```html
 * <lib-dialog [(visible)]="open" header="Edit profile" maximizable>
 *   ...
 *   <ng-template libDialogFooter>...</ng-template>
 * </lib-dialog>
 * ```
 */
@Component({
  selector: 'lib-dialog',
  templateUrl: './dialog.html',
  styleUrl: './dialog.scss',
  imports: [
    NgTemplateOutlet,
    TranslocoPipe,
    UiCopyPipe,
    Button,
    LucideArrowDown,
    LucideArrowDownLeft,
    LucideArrowDownRight,
    LucideArrowLeft,
    LucideArrowRight,
    LucideArrowUp,
    LucideArrowUpLeft,
    LucideArrowUpRight,
    LucideCircleDot,
    LucideMaximize2,
    LucideMinimize2,
    LucideMove,
    LucideX,
    Tooltip,
  ],
  providers: [
    provideTranslocoScope({
      scope: 'dialog',
      loader: {
        el: () => import('./i18n/el'),
        en: () => import('./i18n/en'),
      },
    }),
  ],
})
export class Dialog {
  /** Two-way visibility. */
  readonly visible = model(false);

  /** Initial/preset viewport placement. Updated by the accessible move menu. */
  readonly position = model<DialogPosition>('center');

  /** Token-backed content width. All sizes remain viewport constrained. */
  readonly size = input<DialogSize>('md');

  /** Token-backed height ceiling before the body becomes scrollable. */
  readonly maxHeight = input<DialogMaxHeight>('viewport');

  /** Text rendered in the built-in heading. */
  readonly header = input('');

  /** Uses native modal behavior: focus containment, inert page, and backdrop. */
  readonly modal = input(true, { transform: booleanAttribute });

  /** Shows the built-in close button. */
  readonly closable = input(true, { transform: booleanAttribute });

  /** Allows a modal backdrop click to close the dialog. */
  readonly dismissible = input(false, { transform: booleanAttribute });

  /** Allows Escape to close the dialog. */
  readonly closeOnEscape = input(true, { transform: booleanAttribute });

  /** Allows free pointer dragging and shows the non-drag position chooser. */
  readonly draggable = input(false, { transform: booleanAttribute });

  /** Shows a maximize/restore button. */
  readonly maximizable = input(false, { transform: booleanAttribute });

  /** Current user-controlled maximize state. */
  readonly maximized = model(false);

  /** Permanently fills the viewport and hides maximize/move controls. */
  readonly fullScreen = input(false, { transform: booleanAttribute });

  /** Explicit accessible name, used instead of the built-in heading. */
  readonly ariaLabel = input('');

  /** Id(s) of external labelling elements; takes precedence over `ariaLabel`. */
  readonly ariaLabelledBy = input('');

  /** Id(s) of concise descriptive content. Omit for long/structured bodies. */
  readonly ariaDescribedBy = input('');

  /** Fires when the native dialog becomes visible. */
  readonly opened = output();

  /** Fires after the exit transition and identifies the close path. */
  readonly closed = output<DialogClosedEvent>();

  /** Fires once after a free pointer drag finishes. */
  readonly dragEnded = output<DialogDragEndEvent>();

  protected readonly titleId = `lib-dialog-title-${nextDialogId}`;
  protected readonly moveMenuId = `lib-dialog-move-${nextDialogId++}`;
  protected readonly closing = signal(false);
  protected readonly moveMenuOpen = signal(false);
  protected readonly effectiveFullScreen = computed(() => this.fullScreen() || this.maximized());

  protected readonly customHeader = contentChild(DialogHeader);
  protected readonly customFooter = contentChild(DialogFooter);
  protected readonly headless = contentChild(DialogHeadless);
  protected readonly hasTitle = computed(() => !!this.header() || !!this.customHeader());
  protected readonly hasHeader = computed(
    () => this.hasTitle() || this.closable() || this.draggable() || this.maximizable(),
  );
  protected readonly labelledBy = computed(() => {
    if (this.ariaLabelledBy()) return this.ariaLabelledBy();
    if (this.ariaLabel()) return null;
    return this.hasTitle() ? this.titleId : null;
  });
  protected readonly label = computed(() =>
    this.ariaLabelledBy() ? null : this.ariaLabel() || null,
  );

  private readonly dialog = viewChild.required<ElementRef<HTMLDialogElement>>('dialog');
  private readonly moveControl = viewChild<ElementRef<HTMLElement>>('moveControl');
  private readonly document = inject(DOCUMENT);
  private readonly zone = inject(NgZone);
  private readonly destroyRef = inject(DestroyRef);

  private closeTimeout: ReturnType<typeof setTimeout> | undefined;
  private pendingCloseReason: DialogCloseReason = 'programmatic';
  private openedModally: boolean | null = null;
  private dragX = 0;
  private dragY = 0;
  private lastPosition = this.position();

  protected readonly headlessContext: DialogHeadlessTemplateContext = {
    $implicit: {
      maximized: this.maximized,
      fullScreen: this.effectiveFullScreen,
      close: () => {
        this.close();
      },
      maximize: () => {
        this.maximize();
      },
      restore: () => {
        this.restore();
      },
      moveTo: (position) => {
        this.moveTo(position);
      },
    } satisfies DialogHeadlessContext,
  };

  constructor() {
    afterRenderEffect(() => {
      const shouldOpen = this.visible();
      const modal = this.modal();
      if (shouldOpen) this.open(modal);
      else this.startClose();
    });

    afterRenderEffect(() => {
      const position = this.position();
      const isFullScreen = this.effectiveFullScreen();
      if (position !== this.lastPosition) {
        this.lastPosition = position;
        this.dragX = 0;
        this.dragY = 0;
      }
      this.applyDragOffset(isFullScreen);
      if (isFullScreen) this.setMoveMenuOpen(false);
    });

    afterNextRender(() => {
      const view = this.document.defaultView;
      if (!view) return;
      view.addEventListener('resize', this.onViewportResize);
      this.destroyRef.onDestroy(() => {
        view.removeEventListener('resize', this.onViewportResize);
      });
    });

    this.destroyRef.onDestroy(() => {
      clearTimeout(this.closeTimeout);
      this.document.removeEventListener('pointerdown', this.onDocumentPointerDown, true);
    });
  }

  /** Requests a programmatic close. */
  close(): void {
    this.requestClose('programmatic');
  }

  /** Enters the user-controlled full-viewport state. */
  maximize(): void {
    if (!this.fullScreen()) this.maximized.set(true);
  }

  /** Leaves the user-controlled full-viewport state. */
  restore(): void {
    if (!this.fullScreen()) this.maximized.set(false);
  }

  /** Moves to a semantic viewport position and clears any free-drag offset. */
  moveTo(position: DialogPosition): void {
    this.dragX = 0;
    this.dragY = 0;
    this.position.set(position);
    this.applyDragOffset(false);
    this.setMoveMenuOpen(false);
  }

  protected toggleMaximized(): void {
    if (this.maximized()) this.restore();
    else this.maximize();
  }

  protected toggleMoveMenu(event: MouseEvent): void {
    const opening = !this.moveMenuOpen();
    this.setMoveMenuOpen(opening);
    if (opening && event.detail === 0) {
      queueMicrotask(() => {
        this.moveMenuButtons()[0]?.focus();
      });
    }
  }

  protected onMoveMenuKeydown(event: KeyboardEvent): void {
    if (event.key === 'Escape') {
      event.preventDefault();
      // Escape dismisses the chooser only. Unstopped, the dialog's own `keydown` sees it
      // next — by which point the menu is closed, its `!moveMenuOpen()` guard passes, and a
      // non-modal dialog closes along with the chooser.
      event.stopPropagation();
      this.setMoveMenuOpen(false);
      this.moveControl()?.nativeElement.querySelector('button')?.focus();
      return;
    }

    const columns = 3;
    const delta =
      event.key === 'ArrowRight'
        ? 1
        : event.key === 'ArrowLeft'
          ? -1
          : event.key === 'ArrowDown'
            ? columns
            : event.key === 'ArrowUp'
              ? -columns
              : 0;
    if (!delta) return;

    const buttons = this.moveMenuButtons();
    const current = buttons.indexOf(this.document.activeElement as HTMLButtonElement);
    if (current < 0) return;
    event.preventDefault();
    const next = Math.min(Math.max(current + delta, 0), buttons.length - 1);
    buttons[next]?.focus();
  }

  protected selectPosition(position: DialogPosition): void {
    this.moveTo(position);
    queueMicrotask(() => {
      this.moveControl()?.nativeElement.querySelector('button')?.focus();
    });
  }

  /** Pointer dragging is supplementary; the move menu is the non-drag path. */
  protected onDragStart(event: PointerEvent): void {
    if (
      !this.draggable() ||
      this.effectiveFullScreen() ||
      event.button !== 0 ||
      (event.target as Element).closest('button, a, input, select, textarea')
    ) {
      return;
    }

    event.preventDefault();
    this.setMoveMenuOpen(false);
    const handle = event.currentTarget as HTMLElement;
    const dialog = this.dialog().nativeElement;
    const startX = event.clientX;
    const startY = event.clientY;
    const initialX = this.dragX;
    const initialY = this.dragY;
    const initialRect = dialog.getBoundingClientRect();
    handle.setPointerCapture(event.pointerId);
    dialog.setAttribute('data-dragging', '');

    const move = (moveEvent: PointerEvent): void => {
      const view = this.document.defaultView;
      if (!view) return;
      const deltaX = Math.min(
        Math.max(moveEvent.clientX - startX, -initialRect.left),
        view.innerWidth - initialRect.right,
      );
      const deltaY = Math.min(
        Math.max(moveEvent.clientY - startY, -initialRect.top),
        view.innerHeight - initialRect.bottom,
      );
      this.dragX = initialX + deltaX;
      this.dragY = initialY + deltaY;
      dialog.style.translate = `${this.dragX}px ${this.dragY}px`;
    };

    const end = (): void => {
      handle.removeEventListener('pointermove', move);
      handle.removeEventListener('pointerup', end);
      handle.removeEventListener('pointercancel', end);
      dialog.removeAttribute('data-dragging');
      this.zone.run(() => {
        this.dragEnded.emit({ x: this.dragX, y: this.dragY });
      });
    };

    this.zone.runOutsideAngular(() => {
      handle.addEventListener('pointermove', move);
      handle.addEventListener('pointerup', end);
      handle.addEventListener('pointercancel', end);
    });
  }

  /** Native `cancel`, fired by Escape for modal dialogs. */
  protected onCancel(event: Event): void {
    event.preventDefault();
    if (this.closeOnEscape()) this.requestClose('escape');
  }

  /** Non-modal dialogs do not emit `cancel`, so handle Escape directly. */
  protected onKeydown(event: KeyboardEvent): void {
    if (
      event.key === 'Escape' &&
      !this.openedModally &&
      this.closeOnEscape() &&
      !this.moveMenuOpen()
    ) {
      event.preventDefault();
      this.requestClose('escape');
    }
  }

  protected onBackdropClick(event: MouseEvent): void {
    if (this.openedModally && this.dismissible() && event.target === this.dialog().nativeElement) {
      this.requestClose('backdrop');
    }
  }

  protected closeFromButton(): void {
    this.requestClose('close-button');
  }

  private open(modal: boolean): void {
    const dialog = this.dialog().nativeElement;
    if (this.closing()) {
      clearTimeout(this.closeTimeout);
      this.closing.set(false);
      // The aborted close never emitted, so its reason must not leak into the next one: a
      // plain `visible` write reaches `startClose` without passing through `requestClose`,
      // which is what normally refreshes this.
      this.pendingCloseReason = 'programmatic';
    }

    if (dialog.open && this.openedModally === modal) return;
    const wasOpen = dialog.open;
    if (wasOpen) dialog.close();
    if (modal) dialog.showModal();
    else dialog.show();
    this.openedModally = modal;
    if (!wasOpen) this.opened.emit();
  }

  private requestClose(reason: DialogCloseReason): void {
    if (!this.visible() || this.closing()) return;
    this.pendingCloseReason = reason;
    this.visible.set(false);
  }

  private startClose(): void {
    const dialog = this.dialog().nativeElement;
    if (!dialog.open || this.closing()) return;
    this.closing.set(true);
    this.setMoveMenuOpen(false);
    this.closeTimeout = setTimeout(() => {
      dialog.close();
      this.openedModally = null;
      this.closing.set(false);
      this.closed.emit({ reason: this.pendingCloseReason });
      this.pendingCloseReason = 'programmatic';
    }, DIALOG_CLOSE_DELAY);
  }

  private applyDragOffset(fullScreen: boolean): void {
    const element = this.dialog().nativeElement;
    element.style.translate = fullScreen ? 'none' : `${this.dragX}px ${this.dragY}px`;
  }

  private setMoveMenuOpen(open: boolean): void {
    if (this.moveMenuOpen() === open) return;
    this.moveMenuOpen.set(open);
    if (open) {
      this.document.addEventListener('pointerdown', this.onDocumentPointerDown, true);
    } else {
      this.document.removeEventListener('pointerdown', this.onDocumentPointerDown, true);
    }
  }

  private moveMenuButtons(): HTMLButtonElement[] {
    return Array.from(
      this.moveControl()?.nativeElement.querySelectorAll<HTMLButtonElement>(
        '.dialog-move-option',
      ) ?? [],
    );
  }

  private readonly onDocumentPointerDown = (event: Event): void => {
    if (!this.moveControl()?.nativeElement.contains(event.target as Node)) {
      this.setMoveMenuOpen(false);
    }
  };

  private readonly onViewportResize = (): void => {
    if (!this.visible() || this.effectiveFullScreen()) return;
    const view = this.document.defaultView;
    if (!view) return;
    const rect = this.dialog().nativeElement.getBoundingClientRect();
    if (rect.left < 0) this.dragX -= rect.left;
    if (rect.right > view.innerWidth) this.dragX -= rect.right - view.innerWidth;
    if (rect.top < 0) this.dragY -= rect.top;
    if (rect.bottom > view.innerHeight) this.dragY -= rect.bottom - view.innerHeight;
    this.applyDragOffset(false);
  };
}
