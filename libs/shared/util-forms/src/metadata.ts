import { createMetadataKey, type ReadonlyFieldState } from '@angular/forms/signals';
import type { AnyFieldSpec } from './field-spec.types';

/**
 * The spec a field was declared with, carried on the field itself.
 *
 * A wrapper reads its label, hint and view formatting from here rather than from a parallel map
 * the template has to keep in step with the form.
 */
export const FIELD_SPEC = createMetadataKey<AnyFieldSpec>();

/** The spec a field was declared with, or `undefined` for a field no spec names. */
export function fieldSpec(state: ReadonlyFieldState<unknown>): AnyFieldSpec | undefined {
  return state.metadata(FIELD_SPEC)?.();
}

/**
 * How a value reads in view mode. The empty string means there is nothing to show, and the
 * caller says so with the spec's `empty` text.
 *
 * Only strings, numbers and arrays have an unambiguous default. A date or a boolean reads
 * differently per language and per field, so it needs the spec's own `view`.
 */
export function viewText(spec: AnyFieldSpec | undefined, value: unknown): string {
  if (spec?.view !== undefined) {
    // The erased spec has lost the field's value type; `view` was declared against it.
    return (spec.view as (value: unknown) => string)(value);
  }
  if (typeof value === 'string') return value;
  if (typeof value === 'number') return String(value);
  if (Array.isArray(value)) return (value as unknown[]).map((item) => String(item)).join(', ');
  return '';
}
