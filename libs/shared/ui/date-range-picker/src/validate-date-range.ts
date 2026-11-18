import {
  validate,
  type PathKind,
  type SchemaPath,
  type SchemaPathRules,
} from '@angular/forms/signals';

import { checkDateRange } from './core/date-range';
import type { DateRangeConstraints, DateRangeValue } from './date-range-picker.types';

/**
 * Signal Forms validation matching the picker's limits. An empty range passes: pair it with a
 * `required` rule of the form's own.
 */
export function validateDateRange<TPathKind extends PathKind = PathKind.Root>(
  path: SchemaPath<DateRangeValue, SchemaPathRules.Supported, TPathKind>,
  constraints: DateRangeConstraints = {},
): void {
  validate(path, ({ value }) => {
    const range = value();
    if (!range.from && !range.to) return undefined;
    const kind = checkDateRange(range, constraints);
    return kind ? { kind } : undefined;
  });
}
