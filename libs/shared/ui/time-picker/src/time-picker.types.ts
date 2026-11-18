/** A local, 24-hour time in canonical `HH:mm` form. */
export type TimeValue = string;

/** A half-open range: `start` is included and `end` is excluded. */
export interface TimeRange {
  readonly start: TimeValue;
  readonly end: TimeValue;
}

export type TimePickerMode = 'dropdown' | 'inline' | 'clock';
export type ExcludedTimeDisplay = 'disabled' | 'hidden';
export type TimePickerSize = 'sm' | 'md' | 'lg';

/** Shared constraints used by the component and `validateTime`. */
export interface TimeConstraints {
  /** Earliest selectable time (inclusive). */
  readonly min?: TimeValue;
  /** Latest selectable time (inclusive). */
  readonly max?: TimeValue;
  /** If present, values must be one of these exact times. */
  readonly validTimes?: readonly TimeValue[];
  /** If present, values must fall inside at least one of these ranges. */
  readonly includedRanges?: readonly TimeRange[];
  /** Values inside any of these ranges are unavailable. */
  readonly excludedRanges?: readonly TimeRange[];
  /** Exact unavailable values. */
  readonly excludedTimes?: readonly TimeValue[];
}

export interface TimeSlot {
  readonly value: TimeValue;
  readonly disabled: boolean;
}
