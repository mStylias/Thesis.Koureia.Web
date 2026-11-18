import { resource } from '@angular/core';
import {
  validateAsync,
  type PathKind,
  type SchemaPath,
  type SchemaPathRules,
} from '@angular/forms/signals';
import { PhoneValidationConfig } from './phone-input.types';
import { loadPhoneCountries, loadPhoneUtils, validatePhoneValue } from './phone-validation';

/**
 * Signal Forms schema validation for a phone number field holding an
 * international `+…` string (what `lib-phone-input` writes). Skips empty
 * values — combine with `required()` when the field is mandatory:
 *
 * ```ts
 * const bookingForm = form(model, (booking) => {
 *   required(booking.phone);
 *   validatePhone(booking.phone, { allowedTypes: 'mobile' });
 * });
 * ```
 *
 * Runs asynchronously because the libphonenumber utils (~250 kB) load
 * lazily on first validation; a pre-filled value is therefore
 * re-validated as soon as they arrive, flagging invalid saved numbers.
 */
export function validatePhone<TPathKind extends PathKind = PathKind.Root>(
  path: SchemaPath<string, SchemaPathRules.Supported, TPathKind>,
  config: PhoneValidationConfig = {},
): void {
  validateAsync(path, {
    params: ({ value }) => (value() ? value() : undefined),
    factory: (params) =>
      resource({
        params,
        loader: async ({ params: phoneNumber }) => {
          const [utils, countries] = await Promise.all([loadPhoneUtils(), loadPhoneCountries()]);
          return validatePhoneValue(utils, countries, phoneNumber, config);
        },
      }),
    onSuccess: (error) => error,
    onError: () => ({ kind: 'phoneInvalid' }),
  });
}
