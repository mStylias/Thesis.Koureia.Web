import {
  afterNextRender,
  booleanAttribute,
  Component,
  computed,
  contentChild,
  effect,
  ElementRef,
  input,
  model,
  numberAttribute,
  output,
  signal,
  viewChild,
  viewChildren,
} from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { FormValueControl, type ValidationError } from '@angular/forms/signals';
import { provideTranslocoScope, TranslocoPipe } from '@jsverse/transloco';
import { UiCopyPipe } from '@util/ui-copy';
import { claimFieldError } from '@util/forms';
import {
  InputOtpCellContext,
  InputOtpCellTemplate,
  InputOtpSeparatorTemplate,
} from './input-otp-templates';
import { InputOtpCharset, InputOtpSize } from './input-otp.types';

/** Glyph drawn in place of a character while `mask` is on. */
const MASK_CHAR = '•';

/** Per charset: the single-character gate, and the sanitizer's inverse. */
const CHARSET_PATTERN: Record<InputOtpCharset, { allows: RegExp; strips: RegExp }> = {
  numeric: { allows: /^[0-9]$/, strips: /[^0-9]/g },
  alphanumeric: { allows: /^[a-zA-Z0-9]$/, strips: /[^a-zA-Z0-9]/g },
};

/** Error kinds this control can translate itself; anything else is generic. */
const TRANSLATED_ERRORS = new Set(['required', 'minLength', 'pattern']);

let nextUniqueId = 0;

/**
 * Design-system one-time-password input:
 *
 * ```html
 * <lib-input-otp [(value)]="code" [length]="6" ariaLabel="Verification code" />
 * ```
 *
 * Not one `<input maxlength=1>` per digit but a **single real input laid transparently
 * over the drawn cells**. That keeps arrow keys, Home/End, Backspace, selection, paste,
 * undo and `autocomplete="one-time-code"` native, and gives assistive technology one named
 * control with one tab stop instead of N unnamed boxes whose auto-advance cuts off the
 * character echo.
 *
 * Two behaviours are added on top, both matching split cells: typing over a filled cell
 * replaces it rather than shifting the code right, and focusing a complete code selects it
 * so retyping starts over.
 *
 * Implements `FormValueControl`, so `[formField]` binds everything automatically.
 */
@Component({
  selector: 'lib-input-otp',
  templateUrl: './input-otp.html',
  styleUrl: './input-otp.scss',
  imports: [NgTemplateOutlet, TranslocoPipe, UiCopyPipe],
  providers: [
    provideTranslocoScope({
      scope: 'inputOtp',
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
    '(pointerdown)': 'onPointerdown($event)',
  },
})
export class InputOtp implements FormValueControl<string> {
  /** The entered code. Always sanitized to `charset` and `length`. */
  readonly value = model('');

  /** Number of cells. Defaults to 4; anything below 1 falls back to 4. */
  readonly length = input(4, { transform: numberAttribute });

  /** Characters the control accepts. Defaults to `numeric`. */
  readonly charset = input<InputOtpCharset>('numeric');

  /**
   * Draws `•` per character. Visual only: the value stays a plain text field, so
   * `inputmode`, autofill and paste keep working and no password manager offers to save it.
   */
  readonly mask = input(false, { transform: booleanAttribute });

  /** One-based positions to separate after — `[3]` splits six cells into two threes. */
  readonly separatorAfter = input<readonly number[]>([]);

  /** Control size. Defaults to `md`. */
  readonly size = input<InputOtpSize>('md');

  /** Disables interaction. Bound automatically by `[formField]`. */
  readonly disabled = input(false, { transform: booleanAttribute });

  /** Readable and focusable, but no typing, paste or pointer caret placement. */
  readonly readonly = input(false, { transform: booleanAttribute });

  /** Invalid styling; also reflected as `aria-invalid`. */
  readonly invalid = input(false, { transform: booleanAttribute });

  /** Whether the field has been touched. Bound by `[formField]`. */
  readonly touched = input(false, { transform: booleanAttribute });

  /** Exposed as `aria-required`, never the native attribute. */
  readonly required = input(false, { transform: booleanAttribute });

  /** Validation errors to render. Bound by `[formField]`. */
  readonly errors = input<readonly ValidationError.WithOptionalFieldTree[]>([]);

  /** Focuses on render. Opt-in — only right when the code is the page's whole purpose. */
  readonly autoFocus = input(false, { transform: booleanAttribute });

  /** `id` for the inner input, so an external `<label for>` works. */
  readonly inputId = input('');

  /** `name` for the inner input, for native form submission. */
  readonly name = input('');

  /** Accessible name of the control. Falls back to the translation. */
  readonly ariaLabel = input('');

  /** `id` of the element that labels the control. */
  readonly ariaLabelledby = input('');

  /** Consumer description ids; the control appends its own error id. */
  readonly ariaDescribedby = input('');

  /**
   * Emitted after any edit leaving every cell filled, corrections to an already-complete
   * code included — so an auto-submitting screen resubmits the corrected value.
   */
  readonly completed = output<string>();

  /** Marks the field as touched for Signal Forms once focus leaves. */
  readonly touch = output();

  protected readonly cellTemplate = contentChild(InputOtpCellTemplate);
  protected readonly separatorTemplate = contentChild(InputOtpSeparatorTemplate);

  protected readonly focused = signal(false);
  protected readonly blurred = signal(false);
  protected readonly errorId = `lib-input-otp-error-${nextUniqueId++}`;

  private readonly selectionStart = signal(0);
  private readonly selectionEnd = signal(0);

  /** Cell count, guarded against a zero, negative, or fractional input. */
  protected readonly cellCount = computed(() => {
    const requested = Math.floor(this.length());
    return Number.isFinite(requested) && requested > 0 ? requested : 4;
  });

  /** The value as it is actually rendered and committed. */
  protected readonly code = computed(() => this.sanitize(this.value()).slice(0, this.cellCount()));

  protected readonly collapsed = computed(() => this.selectionStart() === this.selectionEnd());

  protected readonly separators = computed(
    () =>
      new Set(
        this.separatorAfter().filter((position) => position >= 1 && position < this.cellCount()),
      ),
  );

  protected readonly inputMode = computed(() =>
    this.charset() === 'numeric' ? 'numeric' : 'text',
  );

  protected readonly firstError = computed(() => this.errors().at(0));

  /** The message waits for touch or blur, so a pre-filled code accuses nobody. */
  protected readonly showError = computed(
    () => (this.touched() || this.blurred()) && !!this.firstError(),
  );

  protected readonly errorKey = computed(() => {
    const kind = this.firstError()?.kind ?? '';
    return `inputOtp.errors.${TRANSLATED_ERRORS.has(kind) ? kind : 'invalid'}`;
  });

  protected readonly describedBy = computed(
    () =>
      [this.ariaDescribedby(), this.showError() ? this.errorId : ''].filter(Boolean).join(' ') ||
      undefined,
  );

  /** Whether the control may still change its own value. */
  protected readonly editable = computed(() => !this.disabled() && !this.readonly());

  protected readonly cells = computed<InputOtpCellContext[]>(() => {
    const code = this.code();
    const count = this.cellCount();
    const masked = this.mask();
    const showCaret = this.focused() && this.editable();
    const start = this.selectionStart();
    const end = this.selectionEnd();
    // A collapsed caret past the final cell still highlights it, so focus stays visible.
    const caret = Math.min(start, count - 1);

    return Array.from({ length: count }, (_unused, index) => {
      const char = code[index] ?? '';
      return {
        $implicit: char && masked ? MASK_CHAR : char,
        char,
        index,
        filled: char !== '',
        active: showCaret && (start === end ? index === caret : index >= start && index < end),
      };
    });
  });

  private readonly inputRef = viewChild.required<ElementRef<HTMLInputElement>>('otpInput');

  private readonly cellRefs = viewChildren<ElementRef<HTMLElement>>('cellBox');

  private readonly charsetRules = computed(() => CHARSET_PATTERN[this.charset()]);

  constructor() {
    claimFieldError();
    // The rendered code is the sanitized one and the model must follow, or a consumer
    // reads back a value longer or dirtier than what is on screen.
    effect(() => {
      const sanitized = this.code();
      if (sanitized !== this.value()) {
        this.value.set(sanitized);
      }
    });

    afterNextRender(() => {
      if (this.autoFocus() && !this.disabled()) {
        this.focus();
      }
    });
  }

  /** Signal Forms focuses the control through this on submit errors. */
  focus(options?: FocusOptions): void {
    this.inputRef().nativeElement.focus(options);
  }

  protected onFocus(): void {
    this.focused.set(true);
    const code = this.code();
    // Arriving on a full field selects it, so retyping starts over rather than dead-ending
    // against `maxlength`.
    const caret = code.length === this.cellCount() ? 0 : code.length;
    this.select(caret, code.length);
  }

  protected onBlur(): void {
    this.focused.set(false);
    this.blurred.set(true);
    this.touch.emit();
  }

  /**
   * The input's own text is invisible and its glyphs do not line up with the cells, so
   * native caret placement is meaningless. The cell under the pointer decides instead.
   */
  protected onPointerdown(event: PointerEvent): void {
    if (this.disabled()) {
      return;
    }
    event.preventDefault();
    const caret = Math.min(this.cellIndexAt(event.clientX), this.code().length);
    this.inputRef().nativeElement.focus();
    this.select(caret, caret);
  }

  protected onBeforeInput(event: InputEvent): void {
    // Re-checked beyond the native `readonly`: a synthetic event must not edit either.
    if (!this.editable()) {
      event.preventDefault();
      return;
    }
    // Deletions, paste and composition stay native; `onInput` sanitizes the result.
    if (event.inputType !== 'insertText' || !event.data) {
      return;
    }
    // Multi-character insertions (autofill, IME commit, suggestion) go through `onInput`.
    if (event.data.length > 1) {
      return;
    }
    if (!this.charsetRules().allows.test(event.data)) {
      event.preventDefault();
      return;
    }
    const input = this.inputRef().nativeElement;
    const start = input.selectionStart ?? 0;
    const end = input.selectionEnd ?? start;
    // Overwrite, the way split cells behave — rather than shifting the code right, or
    // being silently dropped once `maxlength` is reached.
    if (start === end && start < this.code().length) {
      event.preventDefault();
      const code = this.code();
      this.commit(code.slice(0, start) + event.data + code.slice(start + 1), start + 1);
    }
  }

  protected onInput(): void {
    const input = this.inputRef().nativeElement;
    if (!this.editable()) {
      // Put back what the control is showing rather than accepting an edit.
      input.value = this.code();
      return;
    }
    const clean = this.sanitize(input.value).slice(0, this.cellCount());
    // A rejected character moved the DOM text, so park the caret after what survived.
    const caret = clean === input.value ? (input.selectionStart ?? clean.length) : clean.length;
    this.commit(clean, caret);
  }

  protected syncSelection(): void {
    const input = this.inputRef().nativeElement;
    this.selectionStart.set(input.selectionStart ?? 0);
    this.selectionEnd.set(input.selectionEnd ?? 0);
  }

  private commit(next: string, caret: number): void {
    const input = this.inputRef().nativeElement;
    const previous = this.code();
    // Written to the DOM first: if the sanitized text equals the model, `[value]` has
    // nothing to push and the rejected characters would stay on screen.
    if (input.value !== next) {
      input.value = next;
    }
    this.select(caret, caret);

    if (next !== previous) {
      this.value.set(next);
      if (next.length === this.cellCount()) {
        this.completed.emit(next);
      }
    }
  }

  private select(start: number, end: number): void {
    const input = this.inputRef().nativeElement;
    const limit = input.value.length;
    input.setSelectionRange(Math.min(start, limit), Math.min(end, limit));
    this.syncSelection();
  }

  /** Index of the cell under `clientX`; the cell count when past the last. */
  private cellIndexAt(clientX: number): number {
    const cells = this.cellRefs();
    for (const [index, cell] of cells.entries()) {
      if (clientX < cell.nativeElement.getBoundingClientRect().right) {
        return index;
      }
    }
    return cells.length;
  }

  private sanitize(text: string): string {
    return text.replace(this.charsetRules().strips, '');
  }
}
