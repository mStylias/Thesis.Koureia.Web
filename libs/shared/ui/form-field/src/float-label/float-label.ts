import { Component, input } from '@angular/core';
import { FloatLabelVariant } from '../form-field.types';

/**
 * Floats a `<label>` over a form control, moving it clear once the control is focused or
 * filled. An attribute on the wrapper you already write, so it adds no DOM.
 *
 * ```ts
 * import { FloatLabel } from '@ui/form-field';
 * ```
 *
 * ```html
 * <div libFloatLabel variant="in">
 *   <lib-select inputId="city" [options]="cities" [(value)]="city" />
 *   <label for="city">City</label>
 * </div>
 * ```
 *
 * Works with any control that reports state through CSS:
 * - focus — `:focus-within`
 * - filled — a **direct-child** native `input`/`textarea` via `:placeholder-shown` (give it
 *   `placeholder=" "`), or the `data-filled` host attribute
 * - invalid — `aria-invalid="true"` or `data-invalid`
 *
 * Tune it from the wrapper, never a control's `:host` — the label is the control's sibling
 * and inherits nothing set there. `--field-label-inset` offsets it horizontally for a
 * `sm`/`lg` field; `--field-label-bg` masks the `on` variant's notch off `--surface`.
 */
@Component({
  // Attribute selector on the consumer's own wrapper.
  // oxlint-disable-next-line @angular-eslint/component-selector
  selector: '[libFloatLabel]',
  template: '<ng-content />',
  // Styles are global: they must reach the projected label and control, which emulated
  // encapsulation cannot.
  host: {
    '[attr.data-variant]': 'variant()',
  },
})
export class FloatLabel {
  /** Where the label floats: `over` the top border, `in`side the control, or `on` it. */
  readonly variant = input<FloatLabelVariant>('over');
}
