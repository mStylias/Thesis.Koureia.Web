import { Directive, input } from '@angular/core';
import type { FormEditor } from '@util/forms';

/**
 * Carries a {@link FormEditor} to the fields inside a `<form>`, and turns a native submit into a
 * commit.
 *
 * ```html
 * <form [libForm]="editor">
 *   <lib-form-errors />
 *   <lib-field [field]="editor.form.name">…</lib-field>
 * </form>
 * ```
 *
 * `novalidate` is not optional. The editor marks a required field required outside its validation
 * gate, so a native input carries the native attribute from the first render, and the browser
 * would otherwise refuse the submit with its own untranslated bubble over the message the field
 * is about to show.
 *
 * Signal Forms' own `[formRoot]` is deliberately not used. It calls `submit()` itself, and the
 * editor has to open its gate *before* the form's validity is read — otherwise the first press
 * sees a form nothing has validated yet and sends it.
 */
@Directive({
  selector: 'form[libForm]',
  host: {
    novalidate: '',
    '(submit)': 'submitted($event)',
  },
})
export class FormHost<TModel = unknown> {
  /** The editor this form edits through. */
  readonly editor = input.required<FormEditor<TModel>>({ alias: 'libForm' });

  protected submitted(event: Event): void {
    event.preventDefault();
    void this.editor().commit();
  }
}
