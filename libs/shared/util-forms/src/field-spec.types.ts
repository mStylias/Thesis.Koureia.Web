import type { PathKind, SchemaPath, SchemaPathRules } from '@angular/forms/signals';

/**
 * A path to a field a spec declares. A spec names members of a model, so the path is always a
 * child of the root one.
 */
export type FieldPath<TValue> = SchemaPath<TValue, SchemaPathRules.Supported, PathKind.Child>;

/** A limit alone, or the limit and the message key its failure reports. */
export type FieldLimit<TLimit> = TLimit | readonly [TLimit, string];

/** A rule set for one field, applied behind the commit gate with the spec's own rules. */
export type FieldRules<TValue> = (path: FieldPath<TValue>) => void;

/**
 * Everything one field needs: the copy that names it, the constraints it accepts, and how it
 * reads when the form is not editable.
 *
 * Messages are translation keys, not copy. `lib-field` resolves them, so a library never holds
 * a dictionary of another feature's strings.
 */
export interface FieldSpec<TValue> {
  readonly kind: 'field';
  /** Translation key for the field's label. */
  readonly label?: string;
  /** Translation key for the help text under the control. */
  readonly hint?: string;
  /** Translation key for what view mode says instead of an empty value. */
  readonly empty?: string;
  /** How the value reads in view mode. Returns display text, not a key. */
  readonly view?: (value: TValue) => string;
  /** Required, with an optional message key. */
  readonly required?: boolean | string;
  readonly minLength?: FieldLimit<number>;
  readonly maxLength?: FieldLimit<number>;
  readonly min?: FieldLimit<number | Date>;
  readonly max?: FieldLimit<number | Date>;
  readonly pattern?: FieldLimit<RegExp>;
  readonly email?: boolean | string;
  /** Rules the spec cannot express. Gated with the rest, so they stay silent until a commit. */
  readonly rules?: FieldRules<TValue>;
}

/** A nested object of fields, so a model with groups declares them the same way. */
export interface FieldGroupSpec<TValue> {
  readonly kind: 'group';
  readonly fields: FieldSpecs<TValue>;
}

/** The specs for a model, one entry per member. A member with no entry has no rules and no copy. */
export type FieldSpecs<TModel> = {
  readonly [K in keyof TModel]?: FieldSpec<TModel[K]> | FieldGroupSpec<TModel[K]>;
};

/**
 * A spec with its value type erased.
 *
 * `never` is the assignable-from-anything position for `view`, whose parameter is
 * contravariant, so any `FieldSpec<T>` is an `AnyFieldSpec`. Reading `view` back therefore
 * needs a cast, which `viewText` is the one place to hold.
 */
export type AnyFieldSpec = FieldSpec<never>;

/** Either kind of erased spec, which is what a walk over a spec tree carries. */
export type AnySpec = AnyFieldSpec | FieldGroupSpec<never>;
