import {
  booleanAttribute,
  Component,
  ElementRef,
  input,
  model,
  numberAttribute,
  output,
  viewChild,
} from '@angular/core';
import { FormValueControl } from '@angular/forms/signals';

export type CheckboxSize = 'sm' | 'md' | 'lg';

/**
 * Design-system checkbox wrapping a native `<input type="checkbox">`, so keyboard behaviour,
 * form participation and the `:checked`/`:indeterminate` states stay native; the box and
 * animated check are drawn alongside. Projected content becomes the label.
 *
 * ```ts
 * import { Checkbox } from '@ui/checkbox';
 * ```
 *
 * ```html
 * <lib-checkbox [(value)]="remember">Remember me</lib-checkbox>
 * <lib-checkbox [value]="all" [indeterminate]="some">Select all</lib-checkbox>
 * ```
 *
 * Implements `FormValueControl`, so it binds straight to a field:
 *
 * ```html
 * <lib-checkbox [formField]="form.terms">Accept the terms</lib-checkbox>
 * ```
 */
@Component({
  selector: 'lib-checkbox',
  template: `
    <label class="checkbox">
      <!--
        Required is exposed as aria-required, never the native attribute:
        the native one blocks the submit event outright and raises an
        OS-locale bubble over the form's own translated message.
      -->
      <input
        #nativeInput
        class="checkbox-input"
        type="checkbox"
        [checked]="value()"
        [indeterminate]="indeterminate()"
        [disabled]="disabled()"
        [attr.id]="inputId() || null"
        [attr.name]="name() || null"
        [attr.aria-label]="ariaLabel() || null"
        [attr.aria-labelledby]="ariaLabelledby() || null"
        [attr.aria-describedby]="ariaDescribedby() || null"
        [attr.aria-required]="required() ? true : null"
        [attr.aria-invalid]="invalid() ? true : null"
        [attr.tabindex]="tabIndex()"
        (change)="onChange($event)"
      />
      <span class="checkbox-box" aria-hidden="true">
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="3"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <path class="checkbox-check" pathLength="1" d="M5 13l5 5L19.5 6.5" />
          <path class="checkbox-dash" pathLength="1" d="M6 12h12" />
        </svg>
      </span>
      <span class="checkbox-label"><ng-content /></span>
    </label>
  `,
  styleUrl: './checkbox.scss',
  host: {
    '[attr.data-size]': 'size()',
    '[attr.data-checked]': 'value() ? "" : null',
    '[attr.data-disabled]': 'disabled() ? "" : null',
    '[attr.data-invalid]': 'invalid() ? "" : null',
    '(focusout)': 'touch.emit()',
  },
})
export class Checkbox implements FormValueControl<boolean> {
  /** Checked state. */
  readonly value = model(false);

  /**
   * Mixed state for a parent of a partially-selected group. Display only — the consumer
   * owns the logic, so a click leaving the group partial stays mixed.
   */
  readonly indeterminate = input(false, { transform: booleanAttribute });

  /** Control size. Defaults to `md`. */
  readonly size = input<CheckboxSize>('md');

  /** Disables interaction. Bound automatically by `[formField]`. */
  readonly disabled = input(false, { transform: booleanAttribute });

  /** Invalid styling; also reflected as `aria-invalid`. */
  readonly invalid = input(false, { transform: booleanAttribute });

  /**
   * Marks the checkbox required. Exposed as `aria-required`, never the native attribute,
   * which would hand validation to the browser and block the submit event.
   */
  readonly required = input(false, { transform: booleanAttribute });

  /** `id` for the input, so an external `<label for>` can reference it. */
  readonly inputId = input('');

  /** `name` for the input, for native form participation. */
  readonly name = input('');

  /** Accessible name when no label content is projected. */
  readonly ariaLabel = input('');

  /** `id` of the element that labels the checkbox (e.g. a group legend). */
  readonly ariaLabelledby = input('');

  /** `id`(s) of elements describing the checkbox, e.g. a hint or error. */
  readonly ariaDescribedby = input('');

  /**
   * `tabindex` of the native input. Set it to `-1` inside a composite widget
   * — a grid cell, a tree item — whose own roving tabindex owns the tab stop
   * and forwards activation. Leaving it at `0` there gives the widget two
   * tab stops for one control.
   */
  readonly tabIndex = input(0, { transform: numberAttribute });

  /** Marks the field as touched for Signal Forms once focus leaves. */
  readonly touch = output();

  private readonly nativeInput = viewChild.required<ElementRef<HTMLInputElement>>('nativeInput');

  protected onChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.value.set(input.checked);
    // The browser clears `indeterminate` on click, and since the bound value did not
    // change Angular writes nothing back — leaving the box definite while the consumer
    // still calls the group mixed. Restore it; a real change overwrites this next pass.
    input.indeterminate = this.indeterminate();
  }

  /** Signal Forms focuses the control through this on submit errors. */
  focus(options?: FocusOptions): void {
    this.nativeInput().nativeElement.focus(options);
  }
}
