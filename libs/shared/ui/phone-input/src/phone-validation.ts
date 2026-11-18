import type { Country, Iso2, ItiUtils, NumberType } from 'intl-tel-input';
import type { ValidationError } from '@angular/forms/signals';
import { PhoneNumberKind, PhoneValidationConfig } from './phone-input.types';

/**
 * Pure validation core shared by the `validatePhone` schema function and
 * the component. Everything heavy (libphonenumber utils, country data)
 * is passed in, so callers control when those chunks load.
 */

// The utils expand each entry with FIXED_LINE_OR_MOBILE themselves, so
// listing it here would (transitively) accept the other kind too.
const ALLOWED_NUMBER_TYPES: Record<PhoneNumberKind, NumberType[] | null> = {
  mobile: ['MOBILE'],
  fixedLine: ['FIXED_LINE'],
  any: null,
};

let utilsPromise: Promise<ItiUtils> | undefined;
let countriesPromise: Promise<Country[]> | undefined;

/** Lazily loads libphonenumber utils (~250 kB) once per application. */
export function loadPhoneUtils(): Promise<ItiUtils> {
  utilsPromise ??= import('intl-tel-input/utils').then((module) => module.default);
  return utilsPromise;
}

/** Lazily loads the country metadata (dial codes, area codes). */
export function loadPhoneCountries(): Promise<Country[]> {
  countriesPromise ??= import('intl-tel-input/data').then((module) => module.default);
  return countriesPromise;
}

/** Maps the simplified kind to libphonenumber number types. */
export function allowedNumberTypes(kind: PhoneNumberKind): NumberType[] | null {
  return ALLOWED_NUMBER_TYPES[kind];
}

/**
 * Resolves an international `+…` number to its country: longest matching
 * dial code wins; among countries sharing a dial code (e.g. +1), an
 * area-code match wins, then the country marked as the code's main owner.
 */
export function countryFromNumber(countries: readonly Country[], value: string): Iso2 | undefined {
  if (!value.startsWith('+')) {
    return undefined;
  }
  const digits = value.slice(1).replace(/\D/g, '');
  let best: Country | undefined;
  const areaMatches = (country: Country): boolean =>
    country.areaCodes?.some((code) => digits.slice(country.dialCode.length).startsWith(code)) ??
    false;
  for (const country of countries) {
    if (!digits.startsWith(country.dialCode)) {
      continue;
    }
    if (!best || country.dialCode.length > best.dialCode.length) {
      best = country;
      continue;
    }
    if (country.dialCode.length === best.dialCode.length) {
      const countryArea = areaMatches(country);
      const bestArea = areaMatches(best);
      if (
        (countryArea && !bestArea) ||
        (countryArea === bestArea && country.priority < best.priority)
      ) {
        best = country;
      }
    }
  }
  return best?.iso2;
}

/**
 * Validates an international `+…` phone number. Returns `null` when the
 * number is valid (including passing any custom rule for its country),
 * or a `ValidationError` whose `kind` is a {@link PhoneErrorKind} — or
 * whatever kind a custom rule reports.
 */
export function validatePhoneValue(
  utils: ItiUtils,
  countries: readonly Country[],
  value: string,
  config: PhoneValidationConfig = {},
): ValidationError | null {
  const allowedTypes = config.allowedTypes ?? 'any';
  const country = countryFromNumber(countries, value);
  if (!country) {
    return { kind: 'phoneInvalidCountry' };
  }
  const allowed = allowedNumberTypes(allowedTypes);
  if (!utils.isValidNumberPrecise(value, country, allowed)) {
    // Valid as a number but not as one of the accepted kinds?
    if (allowed && utils.isValidNumberPrecise(value, country, null)) {
      return { kind: 'phoneInvalidType' };
    }
    switch (utils.getValidationError(value, country)) {
      case 'TOO_SHORT':
        return { kind: 'phoneTooShort' };
      case 'TOO_LONG':
        return { kind: 'phoneTooLong' };
      case 'INVALID_COUNTRY_CODE':
        return { kind: 'phoneInvalidCountry' };
      default:
        return { kind: 'phoneInvalid' };
    }
  }
  const rule = config.customRules?.[country];
  if (!rule) {
    return null;
  }
  return rule({
    value,
    country,
    numberType: utils.getNumberType(value, country),
    allowedTypes,
  });
}
