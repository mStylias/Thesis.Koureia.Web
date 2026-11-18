import type { InputNumberMode, InputNumberSize, InputNumberValueFormatter } from '@ui/input-number';

/** A closed numeric range. */
export interface NumberRange {
  readonly start: number;
  readonly end: number;
}

/** Optional bounds used by `validateNumberRange`. */
export interface NumberRangeConstraints {
  readonly domainMin?: number;
  readonly domainMax?: number;
}

/** When draft changes reach the bound value. */
export type RangePickerUpdateOn = 'input' | 'change';

/** Control size, aligned with the number-input sizes. */
export type RangePickerSize = InputNumberSize;

/** Built-in number formatting mode. */
export type RangePickerMode = InputNumberMode;

/** Overrides the built-in formatted value. */
export type RangePickerValueFormatter = InputNumberValueFormatter;

/** Identifies one stable range bound. */
export type RangePickerThumb = 'start' | 'end';
