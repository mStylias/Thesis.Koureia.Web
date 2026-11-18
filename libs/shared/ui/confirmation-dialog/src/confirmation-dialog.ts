import {
  afterNextRender,
  Component,
  computed,
  DestroyRef,
  ElementRef,
  inject,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { provideTranslocoScope, TranslocoPipe } from '@jsverse/transloco';
import { UiCopyPipe } from '@util/ui-copy';
import {
  LucideCircleCheck,
  LucideCircleQuestionMark,
  LucideCircleX,
  LucideInfo,
  LucideSparkles,
  LucideTriangleAlert,
  LucideX,
} from '@lucide/angular';
import { Button } from '@ui/button';
import { CONFIRMATION_CLOSE_DELAY } from './confirmation-dialog.constants';
import { ConfirmationResult, ResolvedConfirmationConfig } from './confirmation-dialog.types';

let nextDialogId = 0;

/**
 * Presentational confirmation dialog rendered in a native `<dialog>`
 * (focus trap, Escape handling, and top-layer stacking come for free).
 * Lifecycle is owned by the caller — open it through
 * `ConfirmationService` instead of using it directly.
 *
 * ```ts
 * import { ConfirmationDialog } from '@ui/confirmation-dialog';
 * ```
 */
@Component({
  selector: 'lib-confirmation-dialog',
  templateUrl: './confirmation-dialog.html',
  styleUrl: './confirmation-dialog.scss',
  imports: [
    TranslocoPipe,
    UiCopyPipe,
    Button,
    LucideCircleCheck,
    LucideCircleQuestionMark,
    LucideCircleX,
    LucideInfo,
    LucideSparkles,
    LucideTriangleAlert,
    LucideX,
  ],
  providers: [
    provideTranslocoScope({
      scope: 'confirmationDialog',
      loader: {
        el: () => import('./i18n/el'),
        en: () => import('./i18n/en'),
      },
    }),
  ],
})
export class ConfirmationDialog {
  /** Fully resolved dialog copy and behavior. */
  readonly config = input.required<ResolvedConfirmationConfig>();

  /** Emitted once, after the exit transition, with how the dialog closed. */
  readonly closed = output<ConfirmationResult>();

  protected readonly titleId = `lib-confirmation-title-${nextDialogId}`;
  protected readonly messageId = `lib-confirmation-message-${nextDialogId++}`;

  // An omitted title/message falls back to the translated default; only an
  // explicit empty string opts out of the element entirely.
  protected readonly showTitle = computed(() => this.config().title !== '');
  protected readonly showMessage = computed(() => this.config().message !== '');

  protected readonly closing = signal(false);

  private readonly dialog = viewChild.required<ElementRef<HTMLDialogElement>>('dialog');

  private closeTimeout: ReturnType<typeof setTimeout> | undefined;

  constructor() {
    afterNextRender(() => {
      this.dialog().nativeElement.showModal();
    });

    // A dialog torn down mid-exit (its host destroyed before the transition
    // ends) would otherwise fire the pending timeout against a destroyed
    // view, where the required viewChild query throws.
    inject(DestroyRef).onDestroy(() => {
      clearTimeout(this.closeTimeout);
    });
  }

  protected confirm(): void {
    this.close('confirmed');
  }

  protected cancel(): void {
    this.close('cancelled');
  }

  protected dismiss(): void {
    this.close('dismissed');
  }

  /** Native `cancel` event — fired by Escape. */
  protected onEscape(event: Event): void {
    // Always take over the close so the exit transition runs.
    event.preventDefault();
    if (this.config().dismissible) {
      this.dismiss();
    }
  }

  /** A click on the `<dialog>` element itself lands on the backdrop. */
  protected onBackdropClick(event: MouseEvent): void {
    if (event.target === this.dialog().nativeElement && this.config().dismissible) {
      this.dismiss();
    }
  }

  private close(result: ConfirmationResult): void {
    if (this.closing()) {
      return;
    }

    this.closing.set(true);

    // Let the exit transition play, then close for real — the native
    // close() also restores focus to the previously focused element.
    this.closeTimeout = setTimeout(() => {
      this.dialog().nativeElement.close();
      this.closed.emit(result);
    }, CONFIRMATION_CLOSE_DELAY);
  }
}
