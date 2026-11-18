/*
 * Public API of @util/forms: the editing policy around a Signal Form. It knows nothing about the
 * DOM and nothing about HTTP — `@ui/form-field` renders it and `@synax/forms` feeds it what a
 * write refused with.
 */

export { field, fields, group } from './field-spec';
export { FIELD_SPEC, fieldSpec, viewText } from './metadata';
export { claimFieldError, FieldErrorSlot } from './field-error-slot';
export { FieldLabelSlot, injectFieldLabelId } from './field-label-slot';
export { formEditor } from './form-editor';
export { focusFirstInvalid } from './first-invalid';
export { placeServerErrors, resolveField } from './server-errors';
export { applySpecMarkers, applySpecValidators } from './spec-schema';

export type {
  AnyFieldSpec,
  AnySpec,
  FieldGroupSpec,
  FieldLimit,
  FieldPath,
  FieldRules,
  FieldSpec,
  FieldSpecs,
} from './field-spec.types';
export type {
  FormAction,
  FormEditor,
  FormEditorConfig,
  FormMode,
  FormRules,
} from './form-editor.types';
export type { FormError, FormFailure, FormMessage, PlacedErrors } from './server-errors.types';
