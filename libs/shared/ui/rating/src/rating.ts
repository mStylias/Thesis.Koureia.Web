import {
  booleanAttribute,
  Component,
  computed,
  ElementRef,
  input,
  model,
  numberAttribute,
  output,
  signal,
  viewChildren,
} from '@angular/core';
import { FormValueControl, type ValidationError } from '@angular/forms/signals';
import { provideTranslocoScope, TranslocoPipe } from '@jsverse/transloco';
import { LucideStar } from '@lucide/angular';
import { UiCopyPipe } from '@util/ui-copy';
import { RatingSize } from './rating.types';

const DEFAULT_MAX = 5;

/** Upper bound on `max`, so a stray value cannot render thousands of stars. */
const MAX_STARS = 10;

/**
 * Design-system star rating. Interactive, it is a radio group of star buttons with one tab
 * stop. With `readonly`, it is a static display announced as one image ("4 of 5 stars").
 *
 * ```ts
 * import { Rating } from '@ui/rating';
 * ```
 *
 * ```html
 * <lib-rating [(value)]="score" />
 * <lib-rating [value]="4" readonly size="sm" />
 * ```
 *
 * Implements `FormValueControl<number | null>`, so it binds straight to a field:
 *
 * ```html
 * <lib-rating [formField]="reviewForm.score" />
 * ```
 */
@Component({
  selector: 'lib-rating',
  imports: [LucideStar, TranslocoPipe, UiCopyPipe],
  providers: [
    provideTranslocoScope({
      scope: 'rating',
      loader: {
        el: () => import('./i18n/el'),
        en: () => import('./i18n/en'),
      },
    }),
  ],
  templateUrl: './rating.html',
  styleUrl: './rating.scss',
  host: {
    '[attr.data-size]': 'size()',
    '[attr.data-disabled]': 'disabled() ? "" : null',
    '[attr.data-invalid]': 'invalid() ? "" : null',
    '[attr.data-readonly]': 'readonly() ? "" : null',
    '[attr.data-filled]': 'value() ? "" : null',
    '(focusout)': 'onFocusout($event)',
  },
})
export class Rating implements FormValueControl<number | null> {
  /** Selected star count; `null` while nothing is rated. */
  readonly value = model<number | null>(null);

  /**
   * Number of stars. Normalized to a whole number from 1 to 10. Defaults to 5. `[formField]`
   * binds it from a `max()` rule on the field.
   */
  readonly max = input<number | undefined, unknown>(DEFAULT_MAX, { transform: numberAttribute });

  /**
   * Renders a static display, announced as one image with the score as its name.
   * `[formField]` binds it from a `readonly()` rule on the field.
   */
  readonly readonly = input(false, { transform: booleanAttribute });

  /** Star size. Defaults to `md`. */
  readonly size = input<RatingSize>('md');

  /** Disables interaction and removes the tab stop. Bound automatically by `[formField]`. */
  readonly disabled = input(false, { transform: booleanAttribute });

  /** Invalid styling; also reflected as `aria-invalid`. Bound automatically by `[formField]`. */
  readonly invalid = input(false, { transform: booleanAttribute });

  /** Touched state. Bound automatically by `[formField]`. */
  readonly touched = input(false, { transform: booleanAttribute });

  /**
   * Marks a rating mandatory. Exposed as `aria-required`, never the native attribute, which
   * would hand validation to the browser and block the submit event.
   */
  readonly required = input(false, { transform: booleanAttribute });

  /** Validation errors. Bound by `[formField]`. The surrounding `lib-field` renders them. */
  readonly errors = input<readonly ValidationError.WithOptionalFieldTree[]>([]);

  /**
   * Accessible name. Interactive, it names the group (default "Rating"). Read-only, it
   * replaces the score summary.
   */
  readonly ariaLabel = input('');

  /** IDs of elements that label the group. Interactive mode only. */
  readonly ariaLabelledby = input('');

  /** IDs of elements that describe the rating, such as a hint or an error. */
  readonly ariaDescribedby = input('');

  /** Marks the field as touched for Signal Forms once focus leaves the control. */
  readonly touch = output();

  private readonly buttons = viewChildren<ElementRef<HTMLButtonElement>>('starButton');

  /** `max` as a whole number from 1 to `MAX_STARS`. */
  protected readonly safeMax = computed(() => {
    const max = Math.floor(this.max() ?? DEFAULT_MAX);
    return Number.isFinite(max) ? Math.min(Math.max(max, 1), MAX_STARS) : DEFAULT_MAX;
  });

  protected readonly stars = computed(() =>
    Array.from({ length: this.safeMax() }, (_, index) => index + 1),
  );

  /** `value` rounded and clamped into `0…max`. `0` means not rated. */
  protected readonly current = computed(() => {
    const value = this.value();
    if (value === null || !Number.isFinite(value)) {
      return 0;
    }
    return Math.min(Math.max(Math.round(value), 0), this.safeMax());
  });

  /** The star under the pointer. Visual only: it never writes `value`. */
  protected readonly preview = signal<number | null>(null);

  /** Stars drawn filled: the hovered star while there is one, else the value. */
  protected readonly shown = computed(() => this.preview() ?? this.current());

  /** The one star in the tab order: the checked one, or the first. */
  protected readonly tabStop = computed(() => this.current() || 1);

  protected readonly interactive = computed(() => !this.readonly() && !this.disabled());

  protected select(star: number): void {
    if (!this.interactive()) {
      return;
    }
    this.value.set(star);
  }

  protected hover(star: number | null): void {
    this.preview.set(this.interactive() ? star : null);
  }

  protected onKeydown(event: KeyboardEvent, star: number): void {
    if (!this.interactive()) {
      return;
    }
    const target = this.keyTarget(event.key, star);
    if (target === null) {
      return;
    }
    event.preventDefault();
    this.value.set(target);
    this.buttons()
      .at(target - 1)
      ?.nativeElement.focus();
  }

  /** Only focus leaving the whole control is a blur, not a move between stars. */
  protected onFocusout(event: FocusEvent): void {
    const host = event.currentTarget as HTMLElement | null;
    if (!host?.contains(event.relatedTarget as Node | null)) {
      this.touch.emit();
    }
  }

  /** Focuses the checked star, or the first. Does nothing when disabled or read-only. */
  focus(options?: FocusOptions): void {
    if (!this.interactive()) {
      return;
    }
    this.buttons()
      .at(this.tabStop() - 1)
      ?.nativeElement.focus(options);
  }

  /** The star a key selects, or `null` for a key the control does not handle. */
  private keyTarget(key: string, star: number): number | null {
    const last = this.safeMax();
    switch (key) {
      case 'ArrowRight':
      case 'ArrowUp':
        return Math.min(this.current() + 1, last);
      case 'ArrowLeft':
      case 'ArrowDown':
        return Math.max(this.current() - 1, 1);
      case 'Home':
        return 1;
      case 'End':
        return last;
      case ' ':
      case 'Enter':
        return star;
      default:
        return null;
    }
  }
}
