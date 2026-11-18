import {
  booleanAttribute,
  Component,
  computed,
  ElementRef,
  inject,
  input,
  linkedSignal,
  LOCALE_ID,
  model,
  numberAttribute,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { FormValueControl, type ValidationError } from '@angular/forms/signals';
import { provideTranslocoScope, TranslocoPipe } from '@jsverse/transloco';
import { UiCopyPipe } from '@util/ui-copy';
import { claimFieldError } from '@util/forms';
import {
  InputNumber,
  type InputNumberCommit,
  type InputNumberMode,
  type InputNumberSize,
  type InputNumberValueFormatter,
} from '@ui/input-number';
import type { NumberRange, RangePickerThumb, RangePickerUpdateOn } from './range-picker.types';
import {
  normalizeDomain,
  normalizeRange,
  normalizeStep,
  rangeRatio,
  snapRangeValue,
} from './range-picker.utils';

let nextUniqueId = 0;

const TRANSLATED_ERRORS = new Map([
  ['required', 'required'],
  ['numberRange.order', 'order'],
  ['numberRange.min', 'min'],
  ['numberRange.max', 'max'],
]);

/**
 * A closed numeric range with two slider thumbs and two exact-value fields.
 *
 * ```html
 * <lib-range-picker
 *   [(value)]="priceRange"
 *   [domainMin]="0"
 *   [domainMax]="100"
 *   [step]="5"
 *   mode="currency"
 *   currency="EUR" />
 * ```
 */
@Component({
  selector: 'lib-range-picker',
  templateUrl: './range-picker.html',
  styleUrl: './range-picker.scss',
  imports: [InputNumber, TranslocoPipe, UiCopyPipe],
  providers: [
    provideTranslocoScope({
      scope: 'rangePicker',
      loader: { el: () => import('./i18n/el'), en: () => import('./i18n/en') },
    }),
  ],
  host: {
    'data-filled': '',
    '[attr.data-size]': 'size()',
    '[attr.data-disabled]': 'disabled() ? "" : null',
    '[attr.data-readonly]': 'readonly() ? "" : null',
    '[attr.data-invalid]': 'invalid() ? "" : null',
    '[attr.data-active-thumb]': 'activeThumb()',
    '(focusout)': 'onFocusout($event)',
  },
})
export class RangePicker implements FormValueControl<NumberRange> {
  /** Selected closed range. */
  readonly value = model<NumberRange>({ start: 0, end: 100 });

  /** Lowest selectable value. */
  readonly domainMin = input(0, { transform: numberAttribute });

  /** Highest selectable value. */
  readonly domainMax = input(100, { transform: numberAttribute });

  /** Slider and field increment. Unusable values fall back to `1`. */
  readonly step = input(1, { transform: numberAttribute });

  /** `input` updates continuously; `change` updates on release or field blur. */
  readonly updateOn = input<RangePickerUpdateOn>('change');

  /** `decimal` or `currency` formatting. */
  readonly mode = input<InputNumberMode>('decimal');

  /** ISO 4217 code used by currency formatting. */
  readonly currency = input('EUR');

  /** BCP 47 formatting locale. Defaults to `LOCALE_ID`. */
  readonly locale = input<string>(inject(LOCALE_ID));

  /** Whether formatted values use digit grouping. */
  readonly useGrouping = input(true, { transform: booleanAttribute });

  /** Minimum formatted fraction digits. */
  readonly minFractionDigits = input<number | undefined>(undefined);

  /** Maximum formatted fraction digits. */
  readonly maxFractionDigits = input<number | undefined>(undefined);

  /** Literal text before each formatted value. */
  readonly prefix = input('');

  /** Literal text after each formatted value. */
  readonly suffix = input('');

  /** Overrides the built-in formatted value. */
  readonly valueFormatter = input<InputNumberValueFormatter | undefined>(undefined);

  /** Control size. */
  readonly size = input<InputNumberSize>('md');

  /** Disables every edit path. Bound by `[formField]`. */
  readonly disabled = input(false, { transform: booleanAttribute });

  /** Keeps values focusable but blocks every edit path. */
  readonly readonly = input(false, { transform: booleanAttribute });

  /** Invalid styling. Bound by `[formField]`. */
  readonly invalid = input(false, { transform: booleanAttribute });

  /** Whether the field has been touched. Bound by `[formField]`. */
  readonly touched = input(false, { transform: booleanAttribute });

  /** Exposed as `aria-required` on the number fields. */
  readonly required = input(false, { transform: booleanAttribute });

  /** Validation errors rendered once the control is touched or blurred. */
  readonly errors = input<readonly ValidationError.WithOptionalFieldTree[]>([]);

  /** Base id for the two endpoint fields. */
  readonly inputId = input('');

  /** Base native form name for the two endpoint fields. */
  readonly name = input('');

  /** Accessible name for the complete range group. */
  readonly ariaLabel = input('');

  /** Id of an external element that labels the complete range group. */
  readonly ariaLabelledby = input('');

  /** Consumer description ids. The control appends its own error id. */
  readonly ariaDescribedby = input('');

  /** Visible label for the lower endpoint field. */
  readonly startLabel = input('');

  /** Visible label for the upper endpoint field. */
  readonly endLabel = input('');

  /** Accessible name for the lower slider thumb. */
  readonly startAriaLabel = input('');

  /** Accessible name for the upper slider thumb. */
  readonly endAriaLabel = input('');

  /** Marks the Signal Forms field touched once focus leaves the composite. */
  readonly touch = output();

  /** Emits the final range at the end of an interaction in either update mode. */
  readonly valueCommitted = output<NumberRange>();

  protected readonly activeThumb = signal<RangePickerThumb>('start');
  protected readonly blurred = signal(false);

  protected readonly domain = computed(() => normalizeDomain(this.domainMin(), this.domainMax()));
  protected readonly safeStep = computed(() => normalizeStep(this.step()));
  protected readonly editable = computed(() => !this.disabled() && !this.readonly());
  protected readonly draft = linkedSignal(() =>
    normalizeRange(this.value(), this.domain(), this.safeStep()),
  );
  protected readonly startFieldValue = linkedSignal<number | undefined>(() => this.draft().start);
  protected readonly endFieldValue = linkedSignal<number | undefined>(() => this.draft().end);
  protected readonly fieldCommitOn = computed<InputNumberCommit>(() =>
    this.updateOn() === 'input' ? 'input' : 'blur',
  );
  protected readonly startRatio = computed(() => rangeRatio(this.draft().start, this.domain()));
  protected readonly endRatio = computed(() => rangeRatio(this.draft().end, this.domain()));

  private readonly uniqueId = `lib-range-picker-${nextUniqueId++}`;
  protected readonly startInputId = computed(() =>
    this.inputId() ? `${this.inputId()}-start` : `${this.uniqueId}-start`,
  );
  protected readonly endInputId = computed(() =>
    this.inputId() ? `${this.inputId()}-end` : `${this.uniqueId}-end`,
  );
  protected readonly startLabelId = computed(() => `${this.startInputId()}-label`);
  protected readonly endLabelId = computed(() => `${this.endInputId()}-label`);
  protected readonly errorId = `${this.uniqueId}-error`;

  protected readonly firstError = computed(() => this.errors().at(0));
  protected readonly showError = computed(
    () => (this.touched() || this.blurred()) && !!this.firstError(),
  );
  protected readonly errorKey = computed(() => {
    const translated = TRANSLATED_ERRORS.get(this.firstError()?.kind ?? '') ?? 'invalid';
    return `rangePicker.errors.${translated}`;
  });
  protected readonly errorParams = computed(() => ({
    min: this.domain().start,
    max: this.domain().end,
  }));
  protected readonly describedBy = computed(
    () =>
      [this.ariaDescribedby(), this.showError() ? this.errorId : ''].filter(Boolean).join(' ') ||
      undefined,
  );

  private readonly formatter = computed(() => {
    const options: Intl.NumberFormatOptions = { useGrouping: this.useGrouping() };
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

  private readonly startSlider = viewChild.required<ElementRef<HTMLInputElement>>('startSlider');
  private readonly endSlider = viewChild.required<ElementRef<HTMLInputElement>>('endSlider');
  private readonly startField = viewChild.required<InputNumber>('startField');
  private readonly endField = viewChild.required<InputNumber>('endField');
  private readonly startFieldContainer =
    viewChild.required<ElementRef<HTMLElement>>('startFieldContainer');
  private readonly endFieldContainer =
    viewChild.required<ElementRef<HTMLElement>>('endFieldContainer');

  private readonly interactionStarted = signal(false);
  private readonly interactionDirty = signal(false);
  private dragPointerId: number | null = null;

  constructor() {
    claimFieldError();
  }

  protected formatted(value: number): string {
    const body = this.valueFormatter()?.(value) ?? this.formatter().format(value);
    return this.prefix() + body + this.suffix();
  }

  protected onSliderInput(thumb: RangePickerThumb, event: Event): void {
    const slider = event.currentTarget as HTMLInputElement;
    if (!this.editable()) {
      slider.value = String(this.draft()[thumb]);
      return;
    }
    this.interactionStarted.set(true);
    this.updateDraft(thumb, slider.valueAsNumber);
    // Both sliders span the complete domain, so only the model clamps a crossing.
    // Angular skips an unchanged binding, so write the clamped value back here.
    const bound = this.draft()[thumb];
    if (slider.valueAsNumber !== bound) {
      slider.value = String(bound);
    }
  }

  protected onSliderChange(): void {
    if (this.editable()) {
      this.commitInteraction();
    }
  }

  protected onThumbPointerDown(thumb: RangePickerThumb, event: PointerEvent): void {
    this.activeThumb.set(thumb);
    if (!this.editable()) {
      event.preventDefault();
    }
  }

  protected onSliderKeydown(event: KeyboardEvent): void {
    if (this.editable()) {
      return;
    }
    if (
      [
        'ArrowLeft',
        'ArrowRight',
        'ArrowUp',
        'ArrowDown',
        'PageUp',
        'PageDown',
        'Home',
        'End',
      ].includes(event.key)
    ) {
      event.preventDefault();
    }
  }

  protected onTrackPointerDown(event: PointerEvent): void {
    if (event.target instanceof HTMLInputElement || !this.editable()) {
      return;
    }
    event.preventDefault();
    const track = event.currentTarget as HTMLElement;
    const value = this.valueFromPointer(event.clientX, track);
    const thumb = this.nearestThumb(value);
    this.activeThumb.set(thumb);
    this.interactionStarted.set(true);
    this.dragPointerId = event.pointerId;
    track.setPointerCapture(event.pointerId);
    this.sliderFor(thumb).focus();
    this.updateDraft(thumb, value);
  }

  protected onTrackPointerMove(event: PointerEvent): void {
    if (this.dragPointerId !== event.pointerId || !this.editable()) {
      return;
    }
    this.updateDraft(
      this.activeThumb(),
      this.valueFromPointer(event.clientX, event.currentTarget as HTMLElement),
    );
  }

  protected onTrackPointerEnd(event: PointerEvent): void {
    if (this.dragPointerId !== event.pointerId) {
      return;
    }
    const track = event.currentTarget as HTMLElement;
    if (track.hasPointerCapture(event.pointerId)) {
      track.releasePointerCapture(event.pointerId);
    }
    this.dragPointerId = null;
    this.commitInteraction();
  }

  protected onFieldValue(thumb: RangePickerThumb, value: number | undefined): void {
    this.fieldValue(thumb).set(value);
    if (!this.editable()) {
      this.fieldValue(thumb).set(this.draft()[thumb]);
      return;
    }
    if (value !== undefined) {
      this.interactionStarted.set(true);
      this.updateDraft(thumb, value);
    }
  }

  protected onFieldTouch(thumb: RangePickerThumb): void {
    if (this.fieldValue(thumb)() === undefined) {
      const restored = this.draft()[thumb];
      // Writing the child value back echoes as a value change. Restoring the last
      // valid bound is not an edit, so the interaction flag must survive it.
      const started = this.interactionStarted();
      this.fieldValue(thumb).set(restored);
      this.numberFieldFor(thumb).value.set(restored);
      // The child wrote an empty DOM value after Angular cached the same bound value.
      this.numberFieldInputFor(thumb).value = this.formatted(restored);
      this.interactionStarted.set(started);
    }
    this.commitInteraction();
  }

  protected onFocusout(event: FocusEvent): void {
    const target = event.relatedTarget as Node | null;
    const host = event.currentTarget as HTMLElement | null;
    if (!host?.contains(target)) {
      this.commitInteraction();
      this.blurred.set(true);
      this.touch.emit();
    }
  }

  /** Focuses the lower numeric field. */
  focus(options?: FocusOptions): void {
    this.startField().focus(options);
  }

  /**
   * Picks the thumb a track press moves.
   *
   * Outside the range the direction decides, because distance alone leaves a
   * collapsed range unable to open: both bounds are equidistant, the tie takes
   * `start`, and `start` cannot pass `end`.
   */
  private nearestThumb(value: number): RangePickerThumb {
    const current = this.draft();
    if (value > current.end) {
      return 'end';
    }
    if (value < current.start) {
      return 'start';
    }
    return value - current.start <= current.end - value ? 'start' : 'end';
  }

  private updateDraft(thumb: RangePickerThumb, rawValue: number): void {
    const current = this.draft();
    const snapped = snapRangeValue(rawValue, this.domain(), this.safeStep());
    const next =
      thumb === 'start'
        ? { start: Math.min(snapped, current.end), end: current.end }
        : { start: current.start, end: Math.max(snapped, current.start) };
    if (next.start === current.start && next.end === current.end) {
      return;
    }
    this.draft.set(next);
    this.interactionDirty.set(true);
    if (this.updateOn() === 'input') {
      this.value.set(next);
    }
  }

  /** Ends an interaction: writes a changed range, then reports the final one. */
  private commitInteraction(): void {
    if (!this.interactionStarted()) {
      return;
    }
    const next = this.draft();
    if (this.interactionDirty() && this.updateOn() === 'change') {
      this.value.set(next);
    }
    this.interactionStarted.set(false);
    this.interactionDirty.set(false);
    this.valueCommitted.emit(next);
  }

  private valueFromPointer(clientX: number, track: HTMLElement): number {
    const bounds = track.getBoundingClientRect();
    const rawRatio = bounds.width === 0 ? 0 : (clientX - bounds.left) / bounds.width;
    const ratio = Math.min(Math.max(rawRatio, 0), 1);
    const directedRatio = getComputedStyle(track).direction === 'rtl' ? 1 - ratio : ratio;
    return this.domain().start + directedRatio * (this.domain().end - this.domain().start);
  }

  private sliderFor(thumb: RangePickerThumb): HTMLInputElement {
    return thumb === 'start' ? this.startSlider().nativeElement : this.endSlider().nativeElement;
  }

  private fieldValue(thumb: RangePickerThumb) {
    return thumb === 'start' ? this.startFieldValue : this.endFieldValue;
  }

  private numberFieldFor(thumb: RangePickerThumb): InputNumber {
    return thumb === 'start' ? this.startField() : this.endField();
  }

  private numberFieldInputFor(thumb: RangePickerThumb): HTMLInputElement {
    const host =
      thumb === 'start'
        ? this.startFieldContainer().nativeElement
        : this.endFieldContainer().nativeElement;
    const field = host.querySelector('input');
    if (!field) {
      throw new Error('Range endpoint input is not rendered.');
    }
    return field;
  }
}
