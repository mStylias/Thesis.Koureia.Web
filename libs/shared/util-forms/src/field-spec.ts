import type { FieldGroupSpec, FieldSpec, FieldSpecs } from './field-spec.types';

/**
 * Declares one field.
 *
 * ```ts
 * name: field({ label: 'roles.name', required: 'roles.nameRequired', maxLength: 64 })
 * ```
 */
export function field<TValue>(spec: Omit<FieldSpec<TValue>, 'kind'>): FieldSpec<TValue> {
  return { ...spec, kind: 'field' };
}

/** Declares a nested object of fields, matching a nested object in the model. */
export function group<TValue>(fields: FieldSpecs<TValue>): FieldGroupSpec<TValue> {
  return { kind: 'group', fields };
}

/** Identity, so a spec tree declared outside a component stays typed against its model. */
export function fields<TModel>(specs: FieldSpecs<TModel>): FieldSpecs<TModel> {
  return specs;
}
