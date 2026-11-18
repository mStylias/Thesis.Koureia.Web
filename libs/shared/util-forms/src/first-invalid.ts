import type { FieldTree } from '@angular/forms/signals';

/**
 * Puts focus on the first field with something wrong with it.
 *
 * A refused commit otherwise leaves the user hunting for the message, which on a long form or a
 * scrolled panel can be off screen entirely. `errorSummary` walks the tree in order, so its first
 * entry is the first field a reader would reach.
 */
export function focusFirstInvalid<TModel>(form: FieldTree<TModel>): void {
  const firstError = form().errorSummary().at(0);
  if (firstError === undefined) return;

  firstError.fieldTree().formFieldBindings().at(0)?.focus();
}
