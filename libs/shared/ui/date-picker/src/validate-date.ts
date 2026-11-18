import {
  validate,
  type PathKind,
  type SchemaPath,
  type SchemaPathRules,
} from '@angular/forms/signals';
import { DateConstraints } from './date-picker.types';
import { isCanonicalDate, isDateAllowed } from './date-picker.utils';

/** Signal Forms validation matching the picker's availability constraints. */
export function validateDate<TPathKind extends PathKind = PathKind.Root>(
  path: SchemaPath<string, SchemaPathRules.Supported, TPathKind>,
  constraints: DateConstraints = {},
): void {
  validate(path, ({ value }) => {
    const date = value();
    if (!date) {
      return undefined;
    }
    if (!isCanonicalDate(date)) {
      return { kind: 'dateFormat' };
    }
    return isDateAllowed(date, constraints) ? undefined : { kind: 'dateUnavailable' };
  });
}
