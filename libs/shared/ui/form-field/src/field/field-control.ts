import { Directive, HostAttributeToken, computed, inject } from '@angular/core';
import { Field } from './field';

/**
 * Wires a control to the field around it: it takes the id the label points at, and the ids of the
 * hint and the message that describe it.
 *
 * ```html
 * <input libInputText libFieldControl [formField]="editor.form.name" />
 * ```
 *
 * `aria-describedby` is composed, never replaced — an `aria-describedby` the consumer wrote stays,
 * with the field's own ids added to it. Nothing else is bound: `required`, `readonly`, `min`, `max`
 * and the value belong to `[formField]`, and binding them here is both a conflict and an NG8022.
 */
@Directive({
  selector: '[libFieldControl]',
  host: {
    '[id]': 'field.controlId()',
    '[attr.aria-describedby]': 'describedBy() || null',
  },
})
export class FieldControl {
  protected readonly field = inject(Field);

  /** Read once from the attribute, so a consumer's own description is never clobbered. */
  private readonly ownDescription = inject(new HostAttributeToken('aria-describedby'), {
    optional: true,
  });

  protected readonly describedBy = computed(() =>
    [this.ownDescription, this.field.describedBy()].filter((id) => !!id).join(' '),
  );
}
