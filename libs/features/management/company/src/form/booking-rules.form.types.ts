/** The four rules as the form edits them. Minutes, except `maxAdvanceDays`. */
export interface BookingRulesFormValue {
  slotIntervalMinutes: number;
  minLeadTimeMinutes: number;
  maxAdvanceDays: number;
  cancellationCutoffMinutes: number;
}

/** One rule's name. */
export type BookingRuleName = keyof BookingRulesFormValue;
