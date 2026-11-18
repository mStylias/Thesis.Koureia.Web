import { inject } from '@angular/core';
import { injectErrorMessageResolver, SYNAX_ERROR_MESSAGES } from '@synax/client';
import { flattenValidationErrors, parsePropertyPath, type HttpError } from '@synax/client/core';
import type { FormError } from '@util/forms';
import type { FieldByCode, FormErrorMapper } from './form-errors.types';

/**
 * The bridge between the wire and a form.
 *
 * A validation error naming a property becomes a failure on that field; one naming nothing, and a
 * failure the server reported as a code alone, becomes a message for the form's own error area.
 * Nothing is discarded: a property the form does not edit still reaches the user, because a
 * message nobody sees is worse than one in the wrong place.
 *
 * ```ts
 * private readonly formErrors = injectFormErrors();
 * // …
 * return this.formErrors(result.error, { ROLE_NAME_TAKEN: 'name' });
 * ```
 */
export function injectFormErrors(): FormErrorMapper {
  const resolveMessage = injectErrorMessageResolver();
  const codes = inject(SYNAX_ERROR_MESSAGES, { optional: true })?.codes ?? {};

  return (error, fieldByCode) => ({
    errors: formErrors(error, resolveMessage, fieldByCode ?? {}, (code) => {
      const message = codes[code];
      return typeof message === 'function' ? message({ ...error, errorCode: code }) : message;
    }),
  });
}

/**
 * The pure half of {@link injectFormErrors}, for a caller that already has a resolver.
 *
 * `messageFor` is the registry's copy for one validation error's own code. A server reports a
 * field refusal as `VALIDATION_FAILED` with the domain code inside, and the caller's copy for that
 * code wins over the server's description, which is not in the reader's language.
 */
export function formErrors(
  error: HttpError,
  resolveMessage: (error: HttpError) => string,
  fieldByCode: FieldByCode = {},
  messageFor: (code: string) => string | undefined = () => undefined,
): readonly FormError[] {
  const errors: FormError[] = [];

  for (const validation of flattenValidationErrors(error)) {
    errors.push({
      code: validation.code,
      // An empty description is a server that reported only a code, so the registry answers for it.
      message:
        messageFor(validation.code) ??
        (validation.description.length > 0 ? validation.description : resolveMessage(error)),
      path:
        validation.propertyName === undefined
          ? undefined
          : parsePropertyPath(validation.propertyName),
    });
  }

  const blamed = fieldByCode[error.errorCode];
  if (blamed !== undefined) {
    errors.push({
      code: error.errorCode,
      message: resolveMessage(error),
      path: parsePropertyPath(blamed),
    });
  } else if (errors.length === 0) {
    // A refusal with no validation errors at all: the code itself is the whole of what happened.
    errors.push({ code: error.errorCode, message: resolveMessage(error) });
  }

  return errors;
}
