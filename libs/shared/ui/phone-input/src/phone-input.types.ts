import type { Iso2, NumberType } from 'intl-tel-input';
import type { ValidationError } from '@angular/forms/signals';

export type PhoneInputSize = 'sm' | 'md' | 'lg';

/**
 * Which kinds of phone number a usage accepts. `mobile` and `fixedLine`
 * both admit numbers libphonenumber cannot tell apart
 * (`FIXED_LINE_OR_MOBILE`).
 */
export type PhoneNumberKind = 'mobile' | 'fixedLine' | 'any';

/** Error kinds the built-in validation produces, with shipped translations. */
export const PHONE_ERROR_KINDS = [
  'phoneTooShort',
  'phoneTooLong',
  'phoneInvalidCountry',
  'phoneInvalidType',
  'phoneInvalid',
  'phoneGreekMobile',
] as const;

export type PhoneErrorKind = (typeof PHONE_ERROR_KINDS)[number];

/** What a country-specific custom rule gets to look at. */
export interface PhoneRuleContext {
  /** The number under validation, in international `+…` form. */
  readonly value: string;
  /** Country the number belongs to, derived from its dial code. */
  readonly country: Iso2;
  /** libphonenumber's classification of the number, if determinable. */
  readonly numberType: NumberType | null;
  /** The number kinds this usage accepts. */
  readonly allowedTypes: PhoneNumberKind;
}

/**
 * A country-specific rule that runs after the built-in validation
 * passes. Return `null` for valid, or a `ValidationError` — use one of
 * the shipped {@link PhoneErrorKind} kinds for a translated message, or
 * your own kind with an explicit (already translated) `message`.
 */
export type PhoneCustomRule = (ctx: PhoneRuleContext) => ValidationError | null;

/**
 * Validation options, shared by the `validatePhone` schema function and
 * the `lib-phone-input` component — define it once and pass it to both.
 */
export interface PhoneValidationConfig {
  /** Number kinds accepted by this usage. Defaults to `any`. */
  readonly allowedTypes?: PhoneNumberKind;
  /** Extra per-country rules, keyed by ISO2 country code. */
  readonly customRules?: Partial<Record<Iso2, PhoneCustomRule>>;
}
