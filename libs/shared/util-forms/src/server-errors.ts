import type { FieldTree, ReadonlyFieldTree, ValidationError } from '@angular/forms/signals';
import type { FormError, FormMessage, PlacedErrors } from './server-errors.types';

/**
 * Sorts what a write refused with into errors a field owns and messages the form does.
 *
 * A failure whose path names no field the form has becomes a general message rather than being
 * dropped: a message the user never sees is worse than one in the wrong place, and a server that
 * validates a property this form does not edit is a thing that happens.
 */
export function placeServerErrors<TModel>(
  form: FieldTree<TModel>,
  errors: readonly FormError[],
): PlacedErrors {
  const placed: ValidationError.WithOptionalFieldTree[] = [];
  const general: FormMessage[] = [];

  for (const error of errors) {
    const target = error.path === undefined ? undefined : resolveField(form, error.path);
    if (target === undefined) {
      general.push({ code: error.code, message: error.message });
    } else {
      placed.push({ kind: error.code, message: error.message, fieldTree: target });
    }
  }

  return { errors: placed, general };
}

/**
 * Walks path segments down a field tree. Returns `undefined` for a path the form has no field
 * for — the tree's proxy answers an unknown member with `undefined` rather than inventing one.
 */
export function resolveField<TModel>(
  form: FieldTree<TModel>,
  segments: readonly (string | number)[],
): ReadonlyFieldTree<unknown> | undefined {
  if (segments.length === 0) return undefined;

  let current: unknown = form;
  for (const segment of segments) {
    if (current === undefined || current === null) return undefined;
    current = (current as Record<string | number, unknown>)[segment];
  }
  return current === undefined ? undefined : (current as ReadonlyFieldTree<unknown>);
}
