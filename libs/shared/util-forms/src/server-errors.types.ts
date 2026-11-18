import type { ValidationError } from '@angular/forms/signals';

/** One message a write refused with. */
export interface FormMessage {
  /** The machine-readable code, kept so a caller can key off it. */
  readonly code: string;
  /** The user-facing text, already resolved by whoever spoke to the server. */
  readonly message: string;
}

/**
 * One failure a write reported.
 *
 * `path` names the model member it belongs to, already split into segments
 * (`['items', 2, 'name']`), so this library needs no parser and no knowledge of the wire format.
 * A failure with no path belongs to the whole submission.
 */
export interface FormError extends FormMessage {
  readonly path?: readonly (string | number)[];
}

/** What a refused write hands back to the editor. */
export interface FormFailure {
  readonly errors: readonly FormError[];
}

/** Failures sorted into the ones a field owns and the ones the form does. */
export interface PlacedErrors {
  readonly errors: readonly ValidationError.WithOptionalFieldTree[];
  readonly general: readonly FormMessage[];
}
