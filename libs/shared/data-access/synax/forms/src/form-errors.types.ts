import type { FormFailure } from '@util/forms';
import type { HttpError } from '@synax/client/core';

/**
 * Turns a refused write into what a form editor can place.
 *
 * `fieldByCode` maps an `HttpError.errorCode` onto the model property it blames, for the failures
 * a server reports as a code rather than as a property error — a name a company already uses, for
 * instance. The property is written the way the request JSON writes it, so
 * `'items[2].name'` is valid.
 */
export type FormErrorMapper = (error: HttpError, fieldByCode?: FieldByCode) => FormFailure;

/** Model properties keyed by the `HttpError.errorCode` that blames them. */
export type FieldByCode = Readonly<Partial<Record<string, string>>>;
