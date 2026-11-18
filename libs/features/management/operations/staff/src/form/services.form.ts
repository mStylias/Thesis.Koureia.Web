import {
  applyEach,
  applyWhen,
  disabled,
  validate,
  type SchemaPathTree,
} from '@angular/forms/signals';
import { applySpecMarkers, applySpecValidators, field, fields, type FieldPath } from '@util/forms';

import type { ServiceRowFormValue, ServicesFormValue } from './services.form.types';

/** The API's limits, the same as the services drawer's. */
export const PRICE_MAX = 9999.99;
export const DURATION_MIN = 5;
export const DURATION_MAX = 480;
export const MINUTES_STEP = 5;

const K = 'managementStaff.services';

function stepOfFive(path: FieldPath<number | null>): void {
  validate(path, ({ value }) => {
    const minutes = value();
    return minutes !== null && minutes % MINUTES_STEP !== 0
      ? { kind: 'step', message: `${K}.errors.step` }
      : undefined;
  });
}

/** A member's own values. Empty is legal: it follows the base value. */
export const SERVICE_ROW_FIELDS = fields<ServiceRowFormValue>({
  customPrice: field({
    label: `${K}.ownPrice`,
    min: [0, `${K}.errors.priceRange`],
    max: [PRICE_MAX, `${K}.errors.priceRange`],
  }),
  customDurationMinutes: field({
    label: `${K}.ownDuration`,
    min: [DURATION_MIN, `${K}.errors.durationRange`],
    max: [DURATION_MAX, `${K}.errors.durationRange`],
    rules: stepOfFive,
  }),
});

/** A selected row's own values. `formEditor` gates them with the rest. */
export function servicesRules(path: SchemaPathTree<ServicesFormValue>): void {
  applyEach(path.rows, (item) => {
    applyWhen(
      item,
      ({ value }) => value().selected,
      (row) => {
        applySpecValidators(row as SchemaPathTree<ServiceRowFormValue>, SERVICE_ROW_FIELDS);
      },
    );
  });
}

/** The specs, so the controls find their limits, and an unselected row's values disabled. */
export function servicesLiveRules(path: SchemaPathTree<ServicesFormValue>): void {
  applyEach(path.rows, (item) => {
    applySpecMarkers(item as SchemaPathTree<ServiceRowFormValue>, SERVICE_ROW_FIELDS);
    disabled(item.customPrice, { when: (state) => !state.valueOf(item.selected) });
    disabled(item.customDurationMinutes, { when: (state) => !state.valueOf(item.selected) });
  });
}
