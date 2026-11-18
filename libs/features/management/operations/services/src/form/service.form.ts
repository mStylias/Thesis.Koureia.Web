import {
  applyEach,
  applyWhen,
  disabled,
  validate,
  type SchemaPathTree,
} from '@angular/forms/signals';
import { applySpecMarkers, applySpecValidators, field, fields, type FieldPath } from '@util/forms';

import type {
  ServiceFormValue,
  ServiceStaffFormValue,
  ServiceTranslationFormValue,
} from './service.form.types';

/** The API's limits. Minutes move in steps of {@link MINUTES_STEP}. */
export const NAME_MAX_LENGTH = 200;
export const DESCRIPTION_MAX_LENGTH = 1000;
export const PRICE_MAX = 9999.99;
export const DURATION_MIN = 5;
export const DURATION_MAX = 480;
export const BUFFER_MAX = 120;
export const MINUTES_STEP = 5;

const K = 'managementServices.form';

/** A number that is not a multiple of {@link MINUTES_STEP}. An empty field is `required`'s. */
function stepOfFive(path: FieldPath<number | null>): void {
  validate(path, ({ value }) => {
    const minutes = value();
    return minutes !== null && minutes % MINUTES_STEP !== 0
      ? { kind: 'step', message: `${K}.errors.step` }
      : undefined;
  });
}

/** The service's own fields. The per-language and per-barber arrays are declared below. */
export const SERVICE_FIELDS = fields<ServiceFormValue>({
  categoryId: field({ label: `${K}.category` }),
  price: field({
    label: `${K}.price`,
    required: `${K}.errors.priceRequired`,
    min: [0, `${K}.errors.priceRange`],
    max: [PRICE_MAX, `${K}.errors.priceRange`],
  }),
  durationMinutes: field({
    label: `${K}.duration`,
    hint: `${K}.durationHint`,
    required: `${K}.errors.durationRequired`,
    min: [DURATION_MIN, `${K}.errors.durationRange`],
    max: [DURATION_MAX, `${K}.errors.durationRange`],
    rules: stepOfFive,
  }),
  bufferBeforeMinutes: field({
    label: `${K}.bufferBefore`,
    min: [0, `${K}.errors.bufferRange`],
    max: [BUFFER_MAX, `${K}.errors.bufferRange`],
    rules: stepOfFive,
  }),
  bufferAfterMinutes: field({
    label: `${K}.bufferAfter`,
    min: [0, `${K}.errors.bufferRange`],
    max: [BUFFER_MAX, `${K}.errors.bufferRange`],
    rules: stepOfFive,
  }),
  isActive: field({ label: `${K}.isActive`, hint: `${K}.isActiveHint` }),
});

/** One language's name and description. */
export const TRANSLATION_FIELDS = fields<ServiceTranslationFormValue>({
  name: field({
    label: `${K}.name`,
    required: `${K}.errors.nameRequired`,
    maxLength: [NAME_MAX_LENGTH, `${K}.errors.nameTooLong`],
  }),
  description: field({
    label: `${K}.description`,
    maxLength: [DESCRIPTION_MAX_LENGTH, `${K}.errors.descriptionTooLong`],
  }),
});

/** A barber's own values. Empty is legal: it follows the base value. */
export const STAFF_FIELDS = fields<ServiceStaffFormValue>({
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

/** The array items' validators. `formEditor` gates them with the rest. */
export function serviceRules(path: SchemaPathTree<ServiceFormValue>): void {
  applyEach(path.translations, (item) => {
    applySpecValidators(item as SchemaPathTree<ServiceTranslationFormValue>, TRANSLATION_FIELDS);
  });
  applyEach(path.staff, (item) => {
    applyWhen(
      item,
      ({ value }) => value().selected,
      (row) => {
        applySpecValidators(row as SchemaPathTree<ServiceStaffFormValue>, STAFF_FIELDS);
      },
    );
  });
}

/**
 * The array items' specs, so `lib-field` finds their labels, and the own values of a barber who
 * does not perform the service, which are disabled.
 */
export function serviceLiveRules(path: SchemaPathTree<ServiceFormValue>): void {
  applyEach(path.translations, (item) => {
    applySpecMarkers(item as SchemaPathTree<ServiceTranslationFormValue>, TRANSLATION_FIELDS);
  });
  applyEach(path.staff, (item) => {
    applySpecMarkers(item as SchemaPathTree<ServiceStaffFormValue>, STAFF_FIELDS);
    disabled(item.customPrice, { when: (field) => !field.valueOf(item.selected) });
    disabled(item.customDurationMinutes, { when: (field) => !field.valueOf(item.selected) });
  });
}
