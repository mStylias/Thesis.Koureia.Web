import { computed, DestroyRef, inject, Injectable, signal } from '@angular/core';

/**
 * The place under a field where its error shows. A field provides it, and a control that shows
 * its own error claims it. The field then shows nothing, so the user reads one message, not two.
 *
 * The control keeps the message because only the control has copy for its own kinds, such as
 * `timeFormat` or `phoneInvalid`, and for text the user typed that is not yet a value.
 */
@Injectable()
export class FieldErrorSlot {
  private readonly claims = signal(0);

  /** A control under the field shows the error itself. */
  readonly claimed = computed(() => this.claims() > 0);

  /** Returns the release. */
  claim(): () => void {
    this.claims.update((count) => count + 1);
    return () => {
      this.claims.update((count) => count - 1);
    };
  }
}

/**
 * Call it in the constructor of a control that shows its own error message. Under a field, the
 * field then leaves the message to the control until the control is destroyed.
 */
export function claimFieldError(): void {
  // `host` keeps the lookup in the template that declares the control. A picker inside
  // `lib-datetime-picker` gets no errors, so it must not silence a field around the composite.
  const slot = inject(FieldErrorSlot, { optional: true, host: true });
  if (slot !== null) inject(DestroyRef).onDestroy(slot.claim());
}
