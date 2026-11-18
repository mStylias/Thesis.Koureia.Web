import { Component, computed, contentChild, inject, input } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import type { FieldTree, ReadonlyFieldState, ValidationError } from '@angular/forms/signals';
import { TranslocoPipe } from '@jsverse/transloco';
import { LucideDynamicIcon, type LucideIconInput } from '@lucide/angular';
import { UiCopyPipe } from '@util/ui-copy';
import { FieldErrorSlot, FieldLabelSlot, fieldSpec, viewText, type FormMode } from '@util/forms';
import { FloatLabel } from '../float-label/float-label';
import { IftaLabel } from '../ifta-label/ifta-label';
import { FORM_FIELD_TRANSLOCO_SCOPE } from '../form-field.i18n';
import { FormHost } from '../form-host/form-host';
import { FieldEditor, FieldView } from './field-slots';
import type { FieldEditorContext, FieldLabelStyle, FieldViewContext } from './field.types';

let nextUniqueId = 0;

/** The limits a built-in validation error carries, which its message interpolates. */
const LIMIT_KEYS = ['min', 'max', 'minLength', 'maxLength', 'minDate', 'maxDate'] as const;

/**
 * One field of a form: its label, its control, its hint and whatever is wrong with it — or, when
 * the form is not editable, the same field as a line of text.
 *
 * ```ts
 * import { Field, FieldControl, FieldEditor } from '@ui/form-field';
 * ```
 *
 * ```html
 * <lib-field [field]="editor.form.name">
 *   <ng-template libFieldEditor>
 *     <input libInputText libFieldControl placeholder=" " [formField]="editor.form.name" />
 *   </ng-template>
 * </lib-field>
 * ```
 *
 * Everything else comes from the field itself. The label, the hint, the empty-value text and the
 * view formatting are read from the spec the field was declared with (`@util/forms`), and the mode
 * from the `libForm` on the enclosing `<form>` — so turning a form into a read-only view of the
 * same record costs no markup at all.
 *
 * The control lives in a template rather than in projected content on purpose: view mode must not
 * instantiate it. A control that cannot take `libFieldControl` reads the same values from the
 * template context — `<ng-template libFieldEditor let-id let-describedBy="describedBy">`.
 *
 * A message is a translation key. A key the dictionary does not hold renders as itself, which is
 * what puts a server's own sentence on the field that earned it. A control that shows its own
 * error, such as `lib-time-picker`, claims the field's error slot, and the field shows none.
 *
 * `icon` puts a decorative Lucide icon before a `plain` label and the view-mode caption:
 * `<lib-field labelStyle="plain" [icon]="usersIcon" [field]="...">`.
 */
@Component({
  selector: 'lib-field',
  imports: [FloatLabel, IftaLabel, LucideDynamicIcon, NgTemplateOutlet, TranslocoPipe, UiCopyPipe],
  templateUrl: './field.html',
  styleUrl: './field.scss',
  providers: [FORM_FIELD_TRANSLOCO_SCOPE, FieldErrorSlot, FieldLabelSlot],
})
export class Field<TValue = unknown> {
  /** The field this renders. */
  readonly field = input.required<FieldTree<TValue>>();

  /** Where the label sits. `ifta` by default, matching the app's forms. */
  readonly labelStyle = input<FieldLabelStyle>('ifta');

  /** Label key, when the field's spec does not carry one or this field needs a different one. */
  readonly label = input('');

  /** Hint key, likewise. */
  readonly hint = input('');

  /** Icon before the label. Only a `plain` label and the view-mode caption show it. */
  readonly icon = input<LucideIconInput | null>(null);

  /** The control's id. Generated when empty, which is the usual case. */
  readonly inputId = input('');

  /**
   * Overrides the mode the enclosing `libForm` reports. A field outside a form edits by default,
   * so a lone view item needs `mode="view"`.
   */
  readonly mode = input<FormMode | undefined>(undefined);

  private readonly host = inject<FormHost | null>(FormHost, { optional: true });
  private readonly labelSlot = inject(FieldLabelSlot);
  private readonly errorSlot = inject(FieldErrorSlot);
  private readonly uniqueId = nextUniqueId++;

  private readonly editorSlot = contentChild(FieldEditor);
  private readonly viewSlot = contentChild(FieldView);

  /** The id the label points at, which `libFieldControl` puts on the control. */
  readonly controlId = computed(() => this.inputId() || `lib-field-${this.uniqueId}`);

  /** The visible label's own id, for a control that `<label for>` cannot name. */
  protected readonly labelId = computed(() => `${this.controlId()}-label`);

  protected readonly hintId = `lib-field-hint-${this.uniqueId}`;
  protected readonly errorId = `lib-field-error-${this.uniqueId}`;

  private readonly state = computed<ReadonlyFieldState<TValue>>(() => this.field()());
  private readonly spec = computed(() => fieldSpec(this.state()));

  protected readonly labelKey = computed(() => this.label() || (this.spec()?.label ?? ''));
  protected readonly hintKey = computed(() => this.hint() || (this.spec()?.hint ?? ''));
  protected readonly emptyKey = computed(() => this.spec()?.empty ?? 'field.empty');

  protected readonly viewing = computed(() => this.resolvedMode() === 'view');
  protected readonly required = computed(() => this.state().required());

  /**
   * The first thing wrong with the field.
   *
   * One message, not all of them: a field with two failures has one thing for the user to do
   * next, and a stack of red text under a control is read as an error about the form.
   */
  private readonly firstError = computed<ValidationError | undefined>(() =>
    this.state().errors().at(0),
  );

  protected readonly errorKey = computed(() => {
    const error = this.firstError();
    if (error === undefined) return '';
    const message = error.message;
    return message !== undefined && message.length > 0 ? message : `field.errors.${error.kind}`;
  });

  protected readonly errorParams = computed(() => limitParams(this.firstError()));

  /** A control that shows its own error claims the slot, and the field shows none. */
  protected readonly showError = computed(() => !!this.errorKey() && !this.errorSlot.claimed());

  /** The hint and the message, for whatever describes the control. */
  readonly describedBy = computed(() =>
    [this.hintKey() ? this.hintId : '', this.showError() ? this.errorId : '']
      .filter((id) => !!id)
      .join(' '),
  );

  protected readonly editorTemplate = computed(() => this.editorSlot()?.template);
  protected readonly viewTemplate = computed(() => this.viewSlot()?.template);

  protected readonly editorContext = computed<FieldEditorContext>(() => ({
    $implicit: this.controlId(),
    id: this.controlId(),
    describedBy: this.describedBy(),
  }));

  constructor() {
    // Published while a label is drawn: a select's combobox is a `div`, which `for` cannot name.
    this.labelSlot.connect(
      computed(() => (!this.viewing() && this.labelKey() ? this.labelId() : '')),
    );
  }

  protected readonly viewContext = computed<FieldViewContext<TValue>>(() => ({
    $implicit: this.state().value(),
    value: this.state().value(),
    text: this.text(),
  }));

  /** What the value reads as in view mode. Empty when there is nothing to show. */
  protected readonly text = computed(() => viewText(this.spec(), this.state().value()));

  private readonly resolvedMode = computed<FormMode>(
    () => this.mode() ?? this.host?.editor().mode() ?? 'edit',
  );
}

/** The limits an error carries, so its message can interpolate them. */
function limitParams(error: ValidationError | undefined): Record<string, unknown> {
  if (error === undefined) return {};

  const source = error as unknown as Record<string, unknown>;
  const params: Record<string, unknown> = {};
  for (const key of LIMIT_KEYS) {
    const limit = source[key];
    if (limit !== undefined) params[key] = limit;
  }
  // Copy declares the limit it is about as `min` or `max` far more often than as the exact kind,
  // so both names reach the message.
  params['min'] ??= params['minLength'] ?? params['minDate'];
  params['max'] ??= params['maxLength'] ?? params['maxDate'];
  return params;
}
