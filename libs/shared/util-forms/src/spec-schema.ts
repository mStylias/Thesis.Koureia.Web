import {
  email,
  max,
  maxDate,
  maxLength,
  metadata,
  min,
  minDate,
  minLength,
  pattern,
  required,
  MAX_LENGTH,
  MIN_LENGTH,
  PATTERN,
  REQUIRED,
  type SchemaPathTree,
} from '@angular/forms/signals';
import { FIELD_SPEC } from './metadata';
import type { AnyFieldSpec, AnySpec, FieldLimit, FieldPath, FieldSpecs } from './field-spec.types';

/**
 * The pass that runs whatever the commit gate says.
 *
 * It carries the spec itself and the constraint metadata a control needs before it is allowed to
 * report anything: `required` reaches the control as `aria-required` — or, on a native input, as
 * the native attribute the form's `novalidate` neutralizes — and the length limits reach it as
 * `minlength` and `maxlength`. Both keys reduce with `or` and `min`, so the gated validators
 * contributing the same values again changes nothing.
 *
 * `min`, `max` and `email` have no marker: their metadata is selected indirectly through
 * {@link https://angular.dev/guide/forms/signals/custom-controls | a limit selection key}, and
 * with native constraint validation off the only thing they carry is a number input's spinner
 * bounds.
 */
export function applySpecMarkers<TModel>(
  path: SchemaPathTree<TModel>,
  specs: FieldSpecs<TModel>,
): void {
  walkSpecs(path, specs, (fieldPath, spec) => {
    metadata(fieldPath, FIELD_SPEC, () => spec);

    if (spec.required !== undefined && spec.required !== false) {
      metadata(fieldPath, REQUIRED, () => true);
    }
    const minLengthValue = limitOf(spec.minLength);
    if (minLengthValue !== undefined) {
      metadata(fieldPath, MIN_LENGTH, () => minLengthValue);
    }
    const maxLengthValue = limitOf(spec.maxLength);
    if (maxLengthValue !== undefined) {
      metadata(fieldPath, MAX_LENGTH, () => maxLengthValue);
    }
    const patternValue = limitOf(spec.pattern);
    if (patternValue !== undefined) {
      metadata(fieldPath, PATTERN, () => patternValue);
    }
  });
}

/**
 * The pass that runs only once the form has been committed.
 *
 * Every validator lives here, so a field reports nothing until the user has asked for the form to
 * be saved. The casts are the cost of compiling a spec whose value type the walk has erased; each
 * one restores exactly the type the validator it feeds declares.
 */
export function applySpecValidators<TModel>(
  path: SchemaPathTree<TModel>,
  specs: FieldSpecs<TModel>,
): void {
  walkSpecs(path, specs, (fieldPath, spec) => {
    if (spec.required !== undefined && spec.required !== false) {
      required(fieldPath, messageOf(spec.required));
    }
    applyLimit(spec.minLength, (value, message) => {
      minLength(fieldPath as FieldPath<string>, value, message);
    });
    applyLimit(spec.maxLength, (value, message) => {
      maxLength(fieldPath as FieldPath<string>, value, message);
    });
    applyLimit(spec.min, (value, message) => {
      if (value instanceof Date) {
        minDate(fieldPath as FieldPath<Date>, value, message);
      } else {
        min(fieldPath as FieldPath<number>, value, message);
      }
    });
    applyLimit(spec.max, (value, message) => {
      if (value instanceof Date) {
        maxDate(fieldPath as FieldPath<Date>, value, message);
      } else {
        max(fieldPath as FieldPath<number>, value, message);
      }
    });
    applyLimit(spec.pattern, (value, message) => {
      pattern(fieldPath as FieldPath<string>, value, message);
    });
    if (spec.email !== undefined && spec.email !== false) {
      email(fieldPath as FieldPath<string>, messageOf(spec.email));
    }
    spec.rules?.(fieldPath);
  });
}

/** Whether a spec entry carries a message key beside its limit. */
function hasMessage<TLimit>(limit: FieldLimit<TLimit>): limit is readonly [TLimit, string] {
  return Array.isArray(limit);
}

/** The limit a spec entry declares, without its message. */
function limitOf<TLimit>(limit: FieldLimit<TLimit> | undefined): TLimit | undefined {
  if (limit === undefined) return undefined;
  return hasMessage(limit) ? limit[0] : limit;
}

/** Runs `apply` with the limit and its message config, or not at all when there is no limit. */
function applyLimit<TLimit>(
  limit: FieldLimit<TLimit> | undefined,
  apply: (value: TLimit, config: { message?: string }) => void,
): void {
  if (limit === undefined) return;
  if (hasMessage(limit)) {
    apply(limit[0], messageOf(limit[1]));
  } else {
    apply(limit, messageOf(undefined));
  }
}

/** A validator config carrying the message key, or an empty one for the default message. */
function messageOf(message: boolean | string | undefined): { message?: string } {
  return typeof message === 'string' ? { message } : {};
}

/**
 * Visits every field a spec tree declares, with the path that leads to it.
 *
 * The path tree is a proxy whose member reads build child paths. A walk driven by spec keys
 * cannot name those members in the type system, so the read is untyped here and each rule casts
 * back to the type it needs.
 */
function walkSpecs<TModel>(
  path: SchemaPathTree<TModel>,
  specs: FieldSpecs<TModel>,
  visit: (fieldPath: FieldPath<never>, spec: AnyFieldSpec) => void,
): void {
  const members = path as unknown as Record<string, unknown>;
  for (const [key, spec] of Object.entries(specs) as [string, AnySpec | undefined][]) {
    if (spec === undefined) continue;
    const child = members[key];
    if (spec.kind === 'group') {
      walkSpecs(child as SchemaPathTree<never>, spec.fields, visit);
    } else {
      visit(child as FieldPath<never>, spec);
    }
  }
}
