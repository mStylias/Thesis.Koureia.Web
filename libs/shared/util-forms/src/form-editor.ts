import { computed, linkedSignal, signal } from '@angular/core';
import { applyWhen, form, submit, type SchemaPath } from '@angular/forms/signals';
import { focusFirstInvalid } from './first-invalid';
import { placeServerErrors } from './server-errors';
import { applySpecMarkers, applySpecValidators } from './spec-schema';
import type { FormEditor, FormEditorConfig, FormMode } from './form-editor.types';
import type { FormMessage } from './server-errors.types';

/**
 * A Signal Form with the app's editing UX around it.
 *
 * The rules it enforces, in the order a user meets them:
 *
 * 1. Nothing is reported before the user asks for the form to be saved. Every validator sits
 *    behind one `applyWhen` on the root, so until then the form has no errors at all — not
 *    hidden ones. A control cannot withhold the state `[formField]` pushes into it, which is why
 *    the gate is here and not in a template.
 * 2. `commit` opens the gate **before** it submits, so the first press sees the real validity and
 *    a form with an empty required field never reaches the server. From then on validation is
 *    live: messages appear and clear as the user types, with no second press needed.
 * 3. What a write refuses goes back where it came from — a failure naming a property lands on
 *    that field, and the rest stay in {@link FormEditor.generalErrors} for the form's own error
 *    area. A field-scoped one clears itself when that field is edited; a general one is kept
 *    until the next commit, because the whole model is its source and the first keystroke
 *    anywhere would otherwise erase it.
 *
 * Marker metadata — required, the length limits — is applied outside the gate, so a label's
 * asterisk and a control's `aria-required` are right from the first render. The submit path must
 * therefore sit on a form with `novalidate`, which `libForm` in `@ui/form-field` gives it: on a
 * native input the required marker is the native attribute, and the browser would otherwise
 * refuse the submit with its own untranslated bubble.
 */
export function formEditor<TModel, TSource = void>(
  config: FormEditorConfig<TModel, TSource>,
): FormEditor<TModel> {
  const source: () => TSource = config.resetOn ?? ((): TSource => undefined as TSource);

  const committed = linkedSignal<TSource, boolean>({ source, computation: () => false });
  const mode = linkedSignal<TSource, FormMode>({
    source,
    computation: (value) => config.mode?.(value) ?? 'edit',
  });
  const general = signal<readonly FormMessage[]>([]);

  const tree = form(
    config.model,
    (path) => {
      if (config.fields !== undefined) {
        applySpecMarkers(path, config.fields);
      }
      applyWhen(
        // A model this editor is built for is data, never an `AbstractControl`, which is the
        // other half of the union `SchemaPathTree` widens to for an unconstrained type.
        path as SchemaPath<TModel>,
        () => committed(),
        (gated) => {
          if (config.fields !== undefined) {
            applySpecValidators(gated, config.fields);
          }
          config.rules?.(gated);
        },
      );
      config.liveRules?.(path);
    },
    {
      injector: config.injector,
      submission: {
        action: async (field) => {
          const failure = await config.action(field);
          if (failure === undefined) return undefined;

          const placed = placeServerErrors(field, failure.errors);
          general.set(placed.general);
          return placed.errors;
        },
        // Runs when the commit is refused client-side, which is the moment the messages appear.
        onInvalid: (field) => {
          focusFirstInvalid(field);
        },
      },
    },
  );

  return {
    form: tree,
    mode,
    editing: computed(() => mode() !== 'view'),
    viewing: computed(() => mode() === 'view'),
    creating: computed(() => mode() === 'create'),
    committed,
    submitting: computed(() => tree().submitting()),
    generalErrors: general,

    async commit(): Promise<boolean> {
      // Before `submit`, which reads the form's validity to decide whether to run the action at
      // all. Set after it, the first press would submit a form nothing had validated yet.
      committed.set(true);
      general.set([]);

      const written = await submit(tree);
      // `submit` calls a write that placed everything in the general area a success, because it
      // returned no field errors. It is not one.
      return written && general().length === 0;
    },

    reset(value?: TModel): void {
      if (value !== undefined) {
        config.model.set(value);
      }
      tree().reset();
      committed.set(false);
      general.set([]);
    },
  };
}
