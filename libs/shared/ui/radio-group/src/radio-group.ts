import {
  booleanAttribute,
  Component,
  computed,
  ElementRef,
  input,
  model,
  output,
  viewChildren,
} from '@angular/core';
import { FormValueControl } from '@angular/forms/signals';
import {
  RadioGroupOrientation,
  RadioGroupSize,
  RadioGroupVariant,
  RadioOption,
} from './radio-group.types';

/** Distinguishes the native `name` of groups that share a page. */
let nextUid = 0;

/**
 * Design-system radio group. Each option is a real `<input type="radio">` sharing one group
 * `name`, so arrow-key navigation, single selection, focus and form participation come from
 * the browser; we only draw alongside it.
 *
 * ```ts
 * import { RadioGroup } from '@ui/radio-group';
 * ```
 *
 * ```html
 * <lib-radio-group [(value)]="plan" [options]="plans" ariaLabel="Plan" />
 * ```
 *
 * Implements `FormValueControl`, so it binds straight to a field:
 *
 * ```html
 * <lib-radio-group [formField]="form.plan" [options]="plans" variant="card" />
 * ```
 */
@Component({
  selector: 'lib-radio-group',
  templateUrl: './radio-group.html',
  styleUrl: './radio-group.scss',
  host: {
    role: 'radiogroup',
    '[attr.data-size]': 'size()',
    '[attr.data-orientation]': 'orientation()',
    '[attr.data-variant]': 'variant()',
    '[attr.data-disabled]': 'disabled() ? "" : null',
    '[attr.data-invalid]': 'invalid() ? "" : null',
    '[attr.aria-label]': 'ariaLabel() || null',
    '[attr.aria-labelledby]': 'ariaLabelledby() || null',
    '[attr.aria-describedby]': 'ariaDescribedby() || null',
    // Required lives on the group, never as the native attribute on the radios: that blocks
    // the submit event and raises an OS-locale bubble over the form's translated message.
    '[attr.aria-required]': 'required() ? true : null',
    '[attr.aria-invalid]': 'invalid() ? true : null',
    '[attr.aria-orientation]': 'orientation()',
    '(focusout)': 'onFocusout($event)',
  },
})
export class RadioGroup<T> implements FormValueControl<T | null> {
  /** Entries shown as radios. */
  readonly options = input<readonly RadioOption<T>[]>([]);

  /**
   * Selected value; `null` while nothing is. `null` rather than `undefined` is the empty
   * sentinel because Signal Forms builds no child field for `undefined`, so an `undefined`
   * start would break the binding.
   */
  readonly value = model<T | null>(null);

  /** Visual variant. Defaults to `classic`. */
  readonly variant = input<RadioGroupVariant>('classic');

  /** Control size. Defaults to `md`. */
  readonly size = input<RadioGroupSize>('md');

  /** Layout direction of the options. Defaults to `vertical`. */
  readonly orientation = input<RadioGroupOrientation>('vertical');

  /** Disables the whole group. Bound automatically by `[formField]`. */
  readonly disabled = input(false, { transform: booleanAttribute });

  /** Invalid styling; also reflected as `aria-invalid`. */
  readonly invalid = input(false, { transform: booleanAttribute });

  /**
   * Marks a choice mandatory. Exposed as `aria-required`, never the native attribute,
   * which would hand validation to the browser and block the submit event.
   */
  readonly required = input(false, { transform: booleanAttribute });

  /** Shared `name` for the radios. Generated per instance when unset. */
  readonly name = input('');

  /** Accessible name when no external label references the group. */
  readonly ariaLabel = input('');

  /** IDs of elements that label the group (e.g. a heading). */
  readonly ariaLabelledby = input('');

  /** `id`(s) of elements describing the group, e.g. a hint or error. */
  readonly ariaDescribedby = input('');

  /** Marks the field as touched for Signal Forms once focus leaves. */
  readonly touch = output();

  private readonly inputs = viewChildren<ElementRef<HTMLInputElement>>('radioInput');

  private readonly autoName = `lib-radio-group-${nextUid++}`;

  /** The `name` shared by every radio in the group. */
  protected readonly resolvedName = computed(() => this.name() || this.autoName);

  protected select(option: RadioOption<T>): void {
    if (this.disabled() || option.disabled) {
      return;
    }
    this.value.set(option.value);
  }

  /**
   * Only focus leaving the whole group is a blur. Arrow keys hop between radios and each
   * hop fires `focusout`; emitting `touch` there would surface the error mid-choice.
   */
  protected onFocusout(event: FocusEvent): void {
    const target = event.relatedTarget as Node | null;
    const host = (event.currentTarget as HTMLElement | null) ?? undefined;
    if (!host?.contains(target)) {
      this.touch.emit();
    }
  }

  /**
   * Signal Forms focuses through this on submit errors. Mirrors native radiogroup tab
   * behaviour: the selected radio, or the first enabled one.
   */
  focus(options?: FocusOptions): void {
    const inputs = this.inputs();
    const selected = inputs.find((ref) => ref.nativeElement.checked);
    const target = selected ?? inputs.find((ref) => !ref.nativeElement.disabled);
    target?.nativeElement.focus(options);
  }
}
