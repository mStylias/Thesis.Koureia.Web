import { booleanAttribute, Component, input } from '@angular/core';
import { InputTextSize } from './input-text.types';

/**
 * Design-system text input, applied as an attribute on a native `<input>` so semantics,
 * autofill, IME behaviour and form participation stay native and Signal Forms binds
 * straight to the element.
 *
 * ```ts
 * import { InputText } from '@ui/input-text';
 * ```
 *
 * ```html
 * <input libInputText placeholder="Full name" />
 * <input libInputText size="sm" invalid />
 * <input libInputText [formField]="form.name" />
 * ```
 *
 * Composes with `@ui/form-field`'s label wrappers — give it `placeholder=" "` so the float
 * label can detect a value — and with `libInputClear`.
 */
@Component({
  // Attribute selector: the `input` element name cannot carry the lib prefix.
  // oxlint-disable-next-line @angular-eslint/component-selector
  selector: 'input[libInputText]',
  template: '',
  styleUrl: './input-text.scss',
  host: {
    '[attr.data-size]': 'size()',
    '[attr.data-invalid]': 'invalid() ? "" : null',
    '[attr.data-frameless]': 'frameless() ? "" : null',
    '[attr.aria-invalid]': 'invalid() ? true : null',
  },
})
export class InputText {
  /** Control size. Defaults to `md`; shadows the unused native `size` attribute. */
  readonly size = input<InputTextSize>('md');

  /** Invalid styling; also reflected as `aria-invalid`. */
  readonly invalid = input(false, { transform: booleanAttribute });

  /**
   * Hides the border, the background and the focus ring, for a control
   * composed into a frame its parent draws — an editor beside an operation
   * chooser, an input beside a unit select. The parent then owns the resting
   * border, the `:focus-within` ring and the invalid border for the whole
   * group.
   *
   * ```html
   * <div class="my-field">
   *   <button type="button">…</button>
   *   <input libInputText frameless />
   * </div>
   * ```
   *
   * The frame must carry the invalid state, so the user still sees it.
   */
  readonly frameless = input(false, { transform: booleanAttribute });
}
