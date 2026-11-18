import {
  validate,
  type PathKind,
  type SchemaPath,
  type SchemaPathRules,
} from '@angular/forms/signals';
import { TimeConstraints } from './time-picker.types';
import { isTimeAllowed, normalizeTime } from './time-picker.utils';

/**
 * Signal Forms validation matching the picker's constraints. Empty values
 * are ignored; combine this with `required()` when selection is mandatory.
 */
export function validateTime<TPathKind extends PathKind = PathKind.Root>(
  path: SchemaPath<string, SchemaPathRules.Supported, TPathKind>,
  constraints: TimeConstraints = {},
): void {
  validate(path, ({ value }) => {
    if (!value()) {
      return undefined;
    }
    if (!normalizeTime(value())) {
      return { kind: 'timeFormat' };
    }
    return isTimeAllowed(value(), constraints) ? undefined : { kind: 'timeUnavailable' };
  });
}
