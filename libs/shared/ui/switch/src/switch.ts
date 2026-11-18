import {
  booleanAttribute,
  Component,
  ElementRef,
  input,
  model,
  output,
  viewChild,
} from '@angular/core';
import { FormValueControl } from '@angular/forms/signals';
import { SwitchSize } from './switch.types';

/**
 * Design-system switch for an immediately-applied boolean setting.
 * A native checkbox supplies keyboard, focus, and form behavior; `role="switch"`
 * gives assistive technology the expected on/off semantics.
 *
 * ```html
 * <lib-switch [(value)]="reminders">Appointment reminders</lib-switch>
 * <lib-switch [formField]="settingsForm.marketing">Marketing messages</lib-switch>
 * ```
 */
@Component({
  selector: 'lib-switch',
  templateUrl: './switch.html',
  styleUrl: './switch.scss',
  host: {
    '[attr.data-size]': 'size()',
    '[attr.data-checked]': 'value() ? "" : null',
    '[attr.data-filled]': 'value() ? "" : null',
    '[attr.data-disabled]': 'disabled() ? "" : null',
    '[attr.data-invalid]': 'invalid() ? "" : null',
    '(focusout)': 'touch.emit()',
  },
})
export class Switch implements FormValueControl<boolean> {
  /** On/off state. */
  readonly value = model(false);

  /** Control size. Defaults to `md`. */
  readonly size = input<SwitchSize>('md');

  /** Disables interaction. Bound automatically by `[formField]`. */
  readonly disabled = input(false, { transform: booleanAttribute });

  /** Invalid styling; also reflected as `aria-invalid`. */
  readonly invalid = input(false, { transform: booleanAttribute });

  /**
   * Marks the switch required. Bound automatically by `[formField]` and
   * exposed as `aria-required` — never the native attribute, which would
   * hand validation to the browser and block the submit event.
   */
  readonly required = input(false, { transform: booleanAttribute });

  /** `id` for the native input, allowing an external `<label for>`. */
  readonly inputId = input('');

  /** `name` for the input, for native form participation. */
  readonly name = input('');

  /** Accessible name when no visible label is projected. */
  readonly ariaLabel = input('');

  /** IDs of elements that label the switch. */
  readonly ariaLabelledby = input('');

  /** `id`(s) of elements describing the switch, e.g. a hint or error. */
  readonly ariaDescribedby = input('');

  /** Marks the field as touched for Signal Forms once focus leaves. */
  readonly touch = output();

  private readonly nativeInput = viewChild.required<ElementRef<HTMLInputElement>>('nativeInput');

  protected onChange(event: Event): void {
    this.value.set((event.target as HTMLInputElement).checked);
  }

  /** Signal Forms focuses the switch through this on submit errors. */
  focus(options?: FocusOptions): void {
    this.nativeInput().nativeElement.focus(options);
  }
}
