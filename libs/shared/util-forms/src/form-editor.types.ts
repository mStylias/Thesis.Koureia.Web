import type { Injector, Signal, WritableSignal } from '@angular/core';
import type { FieldTree, SchemaPathTree } from '@angular/forms/signals';
import type { FieldSpecs } from './field-spec.types';
import type { FormFailure, FormMessage } from './server-errors.types';

/** What the form is for: reading a record, editing one, or making one. */
export type FormMode = 'view' | 'edit' | 'create';

/**
 * What a commit does. Returns `undefined` when the write went through, or the failures it came
 * back with — the editor places them on their fields and keeps the rest.
 */
export type FormAction<TModel> = (form: FieldTree<TModel>) => Promise<FormFailure | undefined>;

/** Rules the spec cannot express, applied to the whole form. */
export type FormRules<TModel> = (path: SchemaPathTree<TModel>) => void;

export interface FormEditorConfig<TModel, TSource> {
  /** The model the form edits. The caller keeps owning it, exactly as `form()` requires. */
  readonly model: WritableSignal<TModel>;
  /** What a commit does. Declared once, so every submit path runs the same thing. */
  readonly action: FormAction<TModel>;
  /** The fields, their copy and their constraints. */
  readonly fields?: FieldSpecs<TModel>;
  /**
   * What the editor is about — a record id, a route parameter. A new value resets the mode and
   * closes the validation gate again, so moving from one record to another does not carry an
   * open editor or a reported error across.
   */
  readonly resetOn?: () => TSource;
  /** The mode a given source lands in. Defaults to `edit`. */
  readonly mode?: (source: TSource) => FormMode;
  /** Extra rules, gated with the spec's own, so they stay silent until a commit. */
  readonly rules?: FormRules<TModel>;
  /**
   * Rules that must never be gated: `disabled`, `readonly`, `hidden`, `debounce`. A validator
   * here reports before the user has asked for anything, which is what the gate exists to stop.
   */
  readonly liveRules?: FormRules<TModel>;
  /** Injector for `form()`, when the editor is not built in an injection context. */
  readonly injector?: Injector;
}

/**
 * A form and the policy around it.
 *
 * `form` is the plain Signal Forms `FieldTree` — nothing here wraps or hides it, so anything the
 * framework can do to a form is still available.
 */
export interface FormEditor<TModel> {
  readonly form: FieldTree<TModel>;
  /** Writable, so an Edit button is a one-line handler. */
  readonly mode: WritableSignal<FormMode>;
  readonly editing: Signal<boolean>;
  readonly viewing: Signal<boolean>;
  readonly creating: Signal<boolean>;
  /** Whether a commit has been asked for. Until it has, no field reports anything. */
  readonly committed: Signal<boolean>;
  /**
   * Whether a commit is in flight. The only thing that may disable a submit button: validity
   * cannot, because the first press is what reveals it.
   */
  readonly submitting: Signal<boolean>;
  /** What the write refused with that no field owns. Kept until the next commit. */
  readonly generalErrors: Signal<readonly FormMessage[]>;
  /** Validates, then writes. Resolves `true` only when the write went through. */
  commit(): Promise<boolean>;
  /** Puts the model back, forgets what was reported, and closes the gate again. */
  reset(value?: TModel): void;
}
