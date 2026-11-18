import { Directive, TemplateRef, inject } from '@angular/core';
import type { FieldEditorContext, FieldViewContext } from './field.types';

/**
 * Marks the template that holds the control, so view mode never instantiates it.
 *
 * ```html
 * <lib-field [field]="editor.form.name">
 *   <ng-template libFieldEditor>
 *     <input libInputText libFieldControl [formField]="editor.form.name" />
 *   </ng-template>
 * </lib-field>
 * ```
 *
 * The context carries the generated `id` and the composed `aria-describedby`, for a control that
 * cannot take `libFieldControl`: `<ng-template libFieldEditor let-id let-describedBy="describedBy">`.
 */
@Directive({ selector: 'ng-template[libFieldEditor]' })
export class FieldEditor {
  readonly template = inject<TemplateRef<FieldEditorContext>>(TemplateRef);

  /** Types the template's context for the compiler. */
  static ngTemplateContextGuard(
    _directive: FieldEditor,
    context: unknown,
  ): context is FieldEditorContext {
    return context !== null;
  }
}

/**
 * Marks the template that reads the value in view mode. Without one, the field renders its
 * spec's `view` formatting as text.
 *
 * ```html
 * <ng-template libFieldView let-value>{{ value.length }} chosen</ng-template>
 * ```
 */
@Directive({ selector: 'ng-template[libFieldView]' })
export class FieldView<TValue = unknown> {
  readonly template = inject<TemplateRef<FieldViewContext<TValue>>>(TemplateRef);

  /** Types the template's context for the compiler. */
  static ngTemplateContextGuard<TValue>(
    _directive: FieldView<TValue>,
    context: unknown,
  ): context is FieldViewContext<TValue> {
    return context !== null;
  }
}
