import {
  validate,
  type PathKind,
  type SchemaPath,
  type SchemaPathRules,
} from '@angular/forms/signals';
import type { NumberRange, NumberRangeConstraints } from './range-picker.types';

/** Signal Forms validation for finite, ordered values inside optional bounds. */
export function validateNumberRange<TPathKind extends PathKind = PathKind.Root>(
  path: SchemaPath<NumberRange, SchemaPathRules.Supported, TPathKind>,
  constraints: NumberRangeConstraints = {},
): void {
  validate(path, ({ value }) => {
    const range = value();
    if (!Number.isFinite(range.start) || !Number.isFinite(range.end)) {
      return { kind: 'numberRange.invalid' };
    }
    if (range.start > range.end) {
      return { kind: 'numberRange.order' };
    }
    if (constraints.domainMin !== undefined && range.start < constraints.domainMin) {
      return { kind: 'numberRange.min' };
    }
    if (constraints.domainMax !== undefined && range.end > constraints.domainMax) {
      return { kind: 'numberRange.max' };
    }
    return undefined;
  });
}
