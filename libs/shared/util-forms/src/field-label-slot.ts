import { computed, inject, Injectable, signal, type Signal } from '@angular/core';

/**
 * The id of a field's visible label. A field provides it, and a control whose focusable element
 * is not labelable reads it into `aria-labelledby`.
 *
 * `<label for>` names only a native form element. A `div` with `role="combobox"`, which is what
 * `lib-select` and `lib-multi-select` focus, is not one, so without this the label is on screen
 * and the control has no accessible name.
 */
@Injectable()
export class FieldLabelSlot {
  private readonly source = signal<Signal<string> | null>(null);

  /** Empty while the field shows no label. */
  readonly id = computed(() => this.source()?.() ?? '');

  /** The field hands over its label id once, as a signal. */
  connect(id: Signal<string>): void {
    this.source.set(id);
  }
}

/**
 * The id of the label of the field around the control, or `''` outside a field. Use it as the
 * control's `aria-labelledby` when the consumer gives no name of its own.
 */
export function injectFieldLabelId(): Signal<string> {
  // `host` keeps the lookup in the template that declares the control, as `claimFieldError` does.
  const slot = inject(FieldLabelSlot, { optional: true, host: true });
  return computed(() => slot?.id() ?? '');
}
