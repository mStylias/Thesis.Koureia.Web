import type { CompanyBookingRulesResponse } from '@api/company';
import { field, fields } from '@util/forms';

import type { BookingRuleName, BookingRulesFormValue } from './booking-rules.form.types';

const K = 'managementCompany.booking';

/** The rules in the order the card shows them. */
export const BOOKING_RULES: readonly BookingRuleName[] = [
  'slotIntervalMinutes',
  'minLeadTimeMinutes',
  'maxAdvanceDays',
  'cancellationCutoffMinutes',
];

/** The values each select offers. A stored value outside them is added: see {@link ruleChoices}. */
export const BOOKING_RULE_PRESETS: Readonly<Record<BookingRuleName, readonly number[]>> = {
  slotIntervalMinutes: [5, 10, 15, 20, 30, 60],
  minLeadTimeMinutes: [0, 15, 30, 60, 120, 180, 360, 720, 1440, 2880],
  maxAdvanceDays: [7, 14, 21, 30, 45, 60],
  cancellationCutoffMinutes: [0, 60, 120, 180, 240, 360, 720, 1440, 2880],
};

export const BOOKING_RULES_FIELDS = fields<BookingRulesFormValue>({
  slotIntervalMinutes: field({
    label: `${K}.labels.slotIntervalMinutes`,
    hint: `${K}.hints.slotIntervalMinutes`,
  }),
  minLeadTimeMinutes: field({
    label: `${K}.labels.minLeadTimeMinutes`,
    hint: `${K}.hints.minLeadTimeMinutes`,
  }),
  maxAdvanceDays: field({
    label: `${K}.labels.maxAdvanceDays`,
    hint: `${K}.hints.maxAdvanceDays`,
  }),
  cancellationCutoffMinutes: field({
    label: `${K}.labels.cancellationCutoffMinutes`,
    hint: `${K}.hints.cancellationCutoffMinutes`,
  }),
});

/**
 * A rule's presets, with the stored value added in its place when it is not one of them. The form
 * then never changes a value the owner did not touch, such as a seeded lead time of 45.
 */
export function ruleChoices(rule: BookingRuleName, stored: number): readonly number[] {
  const presets = BOOKING_RULE_PRESETS[rule];
  return presets.includes(stored) ? presets : [...presets, stored].sort((a, b) => a - b);
}

export function bookingRulesForm(rules: CompanyBookingRulesResponse): BookingRulesFormValue {
  return {
    slotIntervalMinutes: rules.slotIntervalMinutes,
    minLeadTimeMinutes: rules.minLeadTimeMinutes,
    maxAdvanceDays: rules.maxAdvanceDays,
    cancellationCutoffMinutes: rules.cancellationCutoffMinutes,
  };
}
