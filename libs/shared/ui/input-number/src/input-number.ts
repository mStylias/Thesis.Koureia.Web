import {
  booleanAttribute,
  Component,
  computed,
  ElementRef,
  inject,
  input,
  LOCALE_ID,
  model,
  numberAttribute,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { FormValueControl, type ValidationError } from '@angular/forms/signals';
import {
  LucideChevronDown,
  LucideChevronUp,
  LucideMinus,
  LucidePlus,
  LucideX,
} from '@lucide/angular';
import { provideTranslocoScope, TranslocoPipe } from '@jsverse/transloco';
import { UiCopyPipe } from '@util/ui-copy';
import { claimFieldError } from '@util/forms';
import {
  InputNumberButtonLayout,
  InputNumberCommit,
  InputNumberMode,
  InputNumberSize,
  InputNumberValueFormatter,
} from './input-number.types';

let nextUniqueId = 0;

/** Error kinds this control can translate itself; anything else is generic. */
const TRANSLATED_ERRORS = new Set(['required', 'min', 'max']);

/**
 * Design-system number input. Focused, you edit a plain number; on blur it commits, clamped
 * to min/max, and renders through `Intl.NumberFormat` with optional prefix/suffix:
 *
 * ```html
 * <lib-input-number [(value)]="price" mode="currency" currency="EUR" />
 * <lib-input-number [(value)]="minutes" suffix=" min" [min]="0" showButtons />
 * ```
 *
 * The inner input is an ARIA spinbutton: ArrowUp/Down step, Home/End jump to `min`/`max`.
 * Implements `FormValueControl`, so `[formField]` binds everything automatically.
 */
@Component({
  selector: 'lib-input-number',
  templateUrl: './input-number.html',
  styleUrl: './input-number.scss',
  imports: [
    LucideChevronDown,
    LucideChevronUp,
    LucideMinus,
    LucidePlus,
    LucideX,
    TranslocoPipe,
    UiCopyPipe,
  ],
  providers: [
    provideTranslocoScope({
      scope: 'inputNumber',
      loader: {
        el: () => import('./i18n/el'),
        en: () => import('./i18n/en'),
      },
    }),
  ],
  host: {
    '[attr.data-size]': 'size()',
    '[attr.data-disabled]': 'disabled() ? "" : null',
    '[attr.data-readonly]': 'readonly() ? "" : null',
    '[attr.data-invalid]': 'invalid() ? "" : null',
    '[attr.data-frameless]': 'frameless() ? "" : null',
    '[attr.data-buttons]': 'showButtons() ? buttonLayout() : null',
    // Filled contract consumed by the float/IFTA label wrappers.
    '[attr.data-filled]': 'value() !== null ? "" : null',
    '(focusout)': 'onFocusout($event)',
  },
})
export class InputNumber implements FormValueControl<number | null> {
  /** Committed numeric value; `null` while empty, which is what a Signal Form holds. */
  readonly value = model<number | null>(null);

  /** `decimal` (default) or `currency` formatting on blur. */
  readonly mode = input<InputNumberMode>('decimal');

  /** ISO 4217 code used when `mode` is `currency`. */
  readonly currency = input('EUR');

  /** BCP 47 locale for formatting/parsing. Defaults to `LOCALE_ID`. */
  readonly locale = input<string>(inject(LOCALE_ID));

  /** Thousands grouping in the formatted display. */
  readonly useGrouping = input(true, { transform: booleanAttribute });

  /** Minimum fraction digits in the formatted display. */
  readonly minFractionDigits = input<number | undefined>(undefined);

  /** Maximum fraction digits in the formatted display. */
  readonly maxFractionDigits = input<number | undefined>(undefined);

  /** Lower bound; commits and steps clamp to it. */
  readonly min = input<number | undefined>(undefined);

  /** Upper bound; commits and steps clamp to it. */
  readonly max = input<number | undefined>(undefined);

  /** Increment for buttons and arrow keys. Anything unusable falls back to `1`. */
  readonly step = input(1, { transform: numberAttribute });

  /** Literal text before the formatted value (e.g. `↑ `). */
  readonly prefix = input('');

  /** Literal text after the formatted value (e.g. ` min`). */
  readonly suffix = input('');

  /** Overrides the `Intl.NumberFormat` result while preserving `prefix` and `suffix`. */
  readonly valueFormatter = input<InputNumberValueFormatter | undefined>(undefined);

  /** Shows the step buttons. */
  readonly showButtons = input(false, { transform: booleanAttribute });

  /** Step button arrangement. Defaults to `stacked`. */
  readonly buttonLayout = input<InputNumberButtonLayout>('stacked');

  /**
   * When typed text becomes the value.
   *
   * `'blur'`, the default, commits once the control is left: the text is
   * parsed, clamped to {@link min} / {@link max} and re-formatted, which is
   * what lets a reader type `1234.5` and see `1.234,5`.
   *
   * `'input'` commits on every keystroke, **unclamped and unformatted** — a
   * bound would rewrite `1` to the minimum on the way to `15`, and formatting
   * would eat the separator of a half-typed decimal. It is for a control that
   * acts as the reader types: a filter editor, a live search by amount.
   */
  readonly commitOn = input<InputNumberCommit>('blur');

  /** Text shown while empty. */
  readonly placeholder = input('');

  /** Control size. Defaults to `md`. */
  readonly size = input<InputNumberSize>('md');

  /** Disables interaction. Bound automatically by `[formField]`. */
  readonly disabled = input(false, { transform: booleanAttribute });

  /** Readable, but no clear button, no step buttons and no commit of typed text. */
  readonly readonly = input(false, { transform: booleanAttribute });

  /** Invalid styling. Bound automatically by `[formField]`. */
  readonly invalid = input(false, { transform: booleanAttribute });

  /**
   * Hides the border, the background and the focus ring, for a control
   * composed into a frame its parent draws — a number beside an operation
   * chooser, an amount beside a currency select. The parent then owns the
   * resting border, the `:focus-within` ring and the invalid border for the
   * whole group.
   *
   * The error message still renders, floating over the control so it never
   * re-flows the frame around it. A frame inside a scroll container clips it —
   * `@ui/date-picker` puts the same message in an overlay for that reason.
   */
  readonly frameless = input(false, { transform: booleanAttribute });

  /** Whether the field has been touched. Bound by `[formField]`. */
  readonly touched = input(false, { transform: booleanAttribute });

  /** Exposed as `aria-required`, never the native attribute. */
  readonly required = input(false, { transform: booleanAttribute });

  /** Validation errors to render. Bound by `[formField]`. */
  readonly errors = input<readonly ValidationError.WithOptionalFieldTree[]>([]);

  /** Shows a × button that empties the input while it has a value. */
  readonly showClear = input(false, { transform: booleanAttribute });

  /** `id` for the inner input, so an external `<label for>` works. */
  readonly inputId = input('');

  /** `name` for the inner input, for native form submission. */
  readonly name = input('');

  /** Accessible name of the inner input. Falls back to the translation. */
  readonly ariaLabel = input('');

  /** `id` of the element that labels the input (e.g. a float label). */
  readonly ariaLabelledby = input('');

  /** Consumer description ids; the control appends its own error id. */
  readonly ariaDescribedby = input('');

  /** Accessible name of the × button. Falls back to the translation. */
  readonly clearAriaLabel = input('');

  /** Marks the field as touched for Signal Forms once focus leaves. */
  readonly touch = output();

  protected readonly focused = signal(false);
  protected readonly blurred = signal(false);
  protected readonly errorId = `lib-input-number-error-${nextUniqueId++}`;

  /** Formatted text for the blurred display, with prefix/suffix. */
  protected readonly formattedValue = computed(() => {
    const value = this.value();
    if (value === null) {
      return '';
    }
    const formatted = this.valueFormatter()?.(value) ?? this.formatter().format(value);
    return this.prefix() + formatted + this.suffix();
  });

  /** Plain editable text (locale decimal separator, no grouping). */
  protected readonly editValue = computed(() => {
    const value = this.value();
    if (value === null) {
      return '';
    }
    return value.toLocaleString(this.locale(), {
      useGrouping: false,
      maximumFractionDigits: 20,
    });
  });

  /**
   * What the reader has typed, while a control that commits on input holds
   * focus. The value is written back through `[value]`, so without this the
   * binding would replace `1.` with `1` as the decimal point is typed.
   */
  private readonly typedText = signal<string | null>(null);

  protected readonly displayValue = computed(() => {
    if (!this.focused()) {
      return this.formattedValue();
    }
    return this.typedText() ?? this.editValue();
  });

  protected readonly atMin = computed(() => {
    const min = this.min();
    const value = this.value();
    return min !== undefined && value !== null && value <= min;
  });

  protected readonly atMax = computed(() => {
    const max = this.max();
    const value = this.value();
    return max !== undefined && value !== null && value >= max;
  });

  /** Whether the control may still change its own value. */
  protected readonly editable = computed(() => !this.disabled() && !this.readonly());

  protected readonly firstError = computed(() => this.errors().at(0));

  /** The message waits for touch or blur, so a pre-filled value accuses nobody. */
  protected readonly showError = computed(
    () => (this.touched() || this.blurred()) && !!this.firstError(),
  );

  protected readonly errorKey = computed(() => {
    const kind = this.firstError()?.kind ?? '';
    return `inputNumber.errors.${TRANSLATED_ERRORS.has(kind) ? kind : 'invalid'}`;
  });

  protected readonly errorParams = computed(() => ({
    min: this.min() ?? '',
    max: this.max() ?? '',
  }));

  protected readonly describedBy = computed(
    () =>
      [this.ariaDescribedby(), this.showError() ? this.errorId : ''].filter(Boolean).join(' ') ||
      undefined,
  );

  /** Raw `numberAttribute`: a `0`, negative or `NaN` freezes the spinner or poisons the model. */
  private readonly safeStep = computed(() => {
    const step = this.step();
    return Number.isFinite(step) && step > 0 ? step : 1;
  });

  private readonly formatter = computed(() => {
    const options: Intl.NumberFormatOptions = {
      useGrouping: this.useGrouping(),
    };
    if (this.mode() === 'currency') {
      options.style = 'currency';
      options.currency = this.currency();
    }
    if (this.minFractionDigits() !== undefined) {
      options.minimumFractionDigits = this.minFractionDigits();
    }
    if (this.maxFractionDigits() !== undefined) {
      options.maximumFractionDigits = this.maxFractionDigits();
    }
    return new Intl.NumberFormat(this.locale(), options);
  });

  /** Locale decimal separator, e.g. `,` for el-GR. */
  private readonly decimalSeparator = computed(
    () =>
      new Intl.NumberFormat(this.locale())
        .formatToParts(1.1)
        .find((part) => part.type === 'decimal')?.value ?? '.',
  );

  private readonly inputRef = viewChild.required<ElementRef<HTMLInputElement>>('numberInput');

  constructor() {
    claimFieldError();
  }

  protected onFocus(): void {
    this.focused.set(true);
  }

  /** Commits as the reader types, for a control that opted into it. */
  protected onInput(): void {
    if (this.commitOn() !== 'input' || !this.editable()) {
      return;
    }
    const text = this.inputRef().nativeElement.value;
    this.typedText.set(text);
    // Unclamped on purpose: see `commitOn`.
    this.value.set(this.parse(text) ?? null);
  }

  protected onBlur(): void {
    if (this.editable()) {
      this.commit(this.inputRef().nativeElement.value);
    }
    // The reader has stopped typing, so the formatted value takes over again.
    this.typedText.set(null);
    this.focused.set(false);
    // Force the DOM text even when the value did not change — retyped or discarded input.
    this.inputRef().nativeElement.value = this.formattedValue();
  }

  /** Blocks characters that can never be part of a plain number. */
  protected onBeforeInput(event: InputEvent): void {
    if (!event.data) {
      return;
    }
    const allowed = new RegExp(`^[0-9\\-−${this.escape(this.decimalSeparator())}]+$`);
    if (!allowed.test(event.data)) {
      event.preventDefault();
    }
  }

  protected onKeydown(event: KeyboardEvent): void {
    switch (event.key) {
      case 'ArrowUp':
        event.preventDefault();
        this.stepBy(1);
        break;
      case 'ArrowDown':
        event.preventDefault();
        this.stepBy(-1);
        break;
      case 'Home':
        if (this.min() !== undefined) {
          event.preventDefault();
          this.setValue(this.min() ?? null);
        }
        break;
      case 'End':
        if (this.max() !== undefined) {
          event.preventDefault();
          this.setValue(this.max() ?? null);
        }
        break;
    }
  }

  protected stepBy(direction: 1 | -1): void {
    // Re-checked beyond the button: a stale click must not change a locked value.
    if (!this.editable()) {
      return;
    }
    // Uncommitted typed text takes part: "5" + ArrowUp must give 6.
    const typed = this.focused() ? this.parse(this.inputRef().nativeElement.value) : undefined;
    const base = typed ?? this.value() ?? this.min() ?? 0;
    // toFixed guards against float drift (0.1 + 0.2).
    const next = Number((base + direction * this.safeStep()).toFixed(10));
    this.typedText.set(null);
    this.setValue(this.clamp(next));
  }

  /** Step buttons must not steal focus from the input. */
  protected keepFocus(event: Event): void {
    event.preventDefault();
  }

  protected clear(): void {
    if (!this.editable()) {
      return;
    }
    this.value.set(null);
    this.typedText.set(null);
    const input = this.inputRef().nativeElement;
    input.value = '';
    input.focus();
  }

  protected onFocusout(event: FocusEvent): void {
    const target = event.relatedTarget as Node | null;
    const host = (event.currentTarget as HTMLElement | null) ?? undefined;
    if (!host?.contains(target)) {
      this.blurred.set(true);
      this.touch.emit();
    }
  }

  /** Signal Forms focuses the control through this on submit errors. */
  focus(options?: FocusOptions): void {
    this.inputRef().nativeElement.focus(options);
  }

  private commit(text: string): void {
    const parsed = this.parse(text);
    this.value.set(parsed === undefined ? null : this.clamp(parsed));
  }

  /**
   * Extracts the number from user text: strips prefix/suffix, currency and grouping, and
   * maps the locale decimal separator and minus sign to ASCII.
   */
  private parse(text: string): number | undefined {
    const cleaned = text
      .replace(this.prefix(), '')
      .replace(this.suffix(), '')
      .replace(/−/g, '-')
      .split('')
      .filter((char) => /[0-9-]/.test(char) || char === this.decimalSeparator())
      .join('')
      .replace(this.decimalSeparator(), '.');
    if (!cleaned) {
      return undefined;
    }
    const parsed = Number.parseFloat(cleaned);
    return Number.isNaN(parsed) ? undefined : parsed;
  }

  private clamp(value: number): number {
    const min = this.min();
    const max = this.max();
    if (min !== undefined && value < min) {
      return min;
    }
    if (max !== undefined && value > max) {
      return max;
    }
    return value;
  }

  private setValue(value: number | null): void {
    this.value.set(value);
    // Keep the text in step when the DOM ran ahead — uncommitted text plus an arrow key.
    this.inputRef().nativeElement.value = this.focused() ? this.editValue() : this.formattedValue();
  }

  private escape(char: string): string {
    return char.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }
}
