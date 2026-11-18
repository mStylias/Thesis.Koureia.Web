import { PhoneCustomRule } from './phone-input.types';

/**
 * Stricter rule for Greek numbers in mobile-only usages: on top of
 * libphonenumber's validity check, the number must be a 69x mobile —
 * libphonenumber also admits newer ranges (e.g. 68x) that Greek
 * providers don't hand out to consumers. Opt in per usage:
 *
 * ```ts
 * validatePhone(booking.phone, {
 *   allowedTypes: 'mobile',
 *   customRules: { gr: greekMobileRule },
 * });
 * ```
 */
export const greekMobileRule: PhoneCustomRule = ({ value, allowedTypes }) =>
  allowedTypes === 'mobile' && !/^\+3069\d{8}$/.test(value) ? { kind: 'phoneGreekMobile' } : null;
