import { Component } from '@angular/core';

/**
 * IFTA (infield top-aligned) label: permanently small at the top of the control, with the
 * value below it. An attribute on the wrapper you already write.
 *
 * ```ts
 * import { IftaLabel } from '@ui/form-field';
 * ```
 *
 * ```html
 * <div libIftaLabel>
 *   <input id="email" type="email" />
 *   <label for="email">Email</label>
 * </div>
 * ```
 *
 * Controls make room through `--field-pad-top`; direct-child inputs are padded directly.
 * Set `--field-label-inset` on the wrapper — not the control's `:host`, which the label
 * never inherits from — to line it up with a `sm`/`lg` field's horizontal padding.
 */
@Component({
  // Attribute selector on the consumer's own wrapper.
  // oxlint-disable-next-line @angular-eslint/component-selector
  selector: '[libIftaLabel]',
  template: '<ng-content />',
  // Styles are global: they must reach the projected label and control, which emulated
  // encapsulation cannot.
})
export class IftaLabel {}
