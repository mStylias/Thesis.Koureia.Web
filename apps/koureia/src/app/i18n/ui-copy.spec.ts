// The libs do not export their dictionaries, and this spec checks the customer copy against them.
/* oxlint-disable @nx/enforce-module-boundaries */
import type { Translation } from '@jsverse/transloco';
import {
  CUSTOMER_UI_COPY_BRANCH,
  customerUiCopy,
  customerUiCopyEl,
  customerUiCopyEn,
  uiCopyOverrides,
} from '@util/ui-copy';

import confirmationDialogEl from '../../../../../libs/shared/ui/confirmation-dialog/src/i18n/el';
import confirmationDialogEn from '../../../../../libs/shared/ui/confirmation-dialog/src/i18n/en';
import datePickerEl from '../../../../../libs/shared/ui/date-picker/src/i18n/el';
import datePickerEn from '../../../../../libs/shared/ui/date-picker/src/i18n/en';
import dateRangePickerEl from '../../../../../libs/shared/ui/date-range-picker/src/i18n/el';
import dateRangePickerEn from '../../../../../libs/shared/ui/date-range-picker/src/i18n/en';
import datetimePickerEl from '../../../../../libs/shared/ui/datetime-picker/src/i18n/el';
import datetimePickerEn from '../../../../../libs/shared/ui/datetime-picker/src/i18n/en';
import fileUploadEl from '../../../../../libs/shared/ui/file-upload/src/i18n/el';
import fileUploadEn from '../../../../../libs/shared/ui/file-upload/src/i18n/en';
import fieldEl from '../../../../../libs/shared/ui/form-field/src/i18n/el';
import fieldEn from '../../../../../libs/shared/ui/form-field/src/i18n/en';
import imageCropperEl from '../../../../../libs/shared/ui/image-cropper/src/i18n/el';
import imageCropperEn from '../../../../../libs/shared/ui/image-cropper/src/i18n/en';
import inputNumberEl from '../../../../../libs/shared/ui/input-number/src/i18n/el';
import inputNumberEn from '../../../../../libs/shared/ui/input-number/src/i18n/en';
import inputOtpEl from '../../../../../libs/shared/ui/input-otp/src/i18n/el';
import inputOtpEn from '../../../../../libs/shared/ui/input-otp/src/i18n/en';
import multiSelectEl from '../../../../../libs/shared/ui/multi-select/src/i18n/el';
import multiSelectEn from '../../../../../libs/shared/ui/multi-select/src/i18n/en';
import passwordInputEl from '../../../../../libs/shared/ui/password-input/src/i18n/el';
import passwordInputEn from '../../../../../libs/shared/ui/password-input/src/i18n/en';
import phoneInputEl from '../../../../../libs/shared/ui/phone-input/src/i18n/el';
import phoneInputEn from '../../../../../libs/shared/ui/phone-input/src/i18n/en';
import rangePickerEl from '../../../../../libs/shared/ui/range-picker/src/i18n/el';
import rangePickerEn from '../../../../../libs/shared/ui/range-picker/src/i18n/en';
import selectEl from '../../../../../libs/shared/ui/select/src/i18n/el';
import selectEn from '../../../../../libs/shared/ui/select/src/i18n/en';
import timePickerEl from '../../../../../libs/shared/ui/time-picker/src/i18n/el';
import timePickerEn from '../../../../../libs/shared/ui/time-picker/src/i18n/en';
import el from './el';
import en from './en';

// Keyed by each lib's Transloco scope, which is the first segment of its keys.
const libEl: Translation = {
  confirmationDialog: confirmationDialogEl,
  datePicker: datePickerEl,
  dateRangePicker: dateRangePickerEl,
  datetimePicker: datetimePickerEl,
  fileUpload: fileUploadEl,
  field: fieldEl,
  imageCropper: imageCropperEl,
  inputNumber: inputNumberEl,
  inputOtp: inputOtpEl,
  multiSelect: multiSelectEl,
  passwordInput: passwordInputEl,
  phoneInput: phoneInputEl,
  rangePicker: rangePickerEl,
  select: selectEl,
  timePicker: timePickerEl,
};

const libEn: Translation = {
  confirmationDialog: confirmationDialogEn,
  datePicker: datePickerEn,
  dateRangePicker: dateRangePickerEn,
  datetimePicker: datetimePickerEn,
  fileUpload: fileUploadEn,
  field: fieldEn,
  imageCropper: imageCropperEn,
  inputNumber: inputNumberEn,
  inputOtp: inputOtpEn,
  multiSelect: multiSelectEn,
  passwordInput: passwordInputEn,
  phoneInput: phoneInputEn,
  rangePicker: rangePickerEn,
  select: selectEn,
  timePicker: timePickerEn,
};

function read(dictionary: Translation, key: string): unknown {
  return key
    .split('.')
    .reduce<unknown>(
      (node, segment) =>
        node !== null && typeof node === 'object'
          ? (node as Record<string, unknown>)[segment]
          : undefined,
      dictionary,
    );
}

function params(text: string): string[] {
  return [...text.matchAll(/\{\{\s*(\w+)\s*\}\}/g)].map((match) => match[1]).sort();
}

// An imperative in -τε or -είτε, or a polite pronoun.
const POLITE_VERB = /\p{L}τε(?!\p{L})/u;
const POLITE_PRONOUN = /(?<!\p{L})(σας|εσείς)(?!\p{L})/iu;

const libKeys = Object.keys(customerUiCopy());

describe('customer ui copy', () => {
  it('maps each Greek key to the same key under the uiCopy branch', () => {
    expect(customerUiCopy()).toEqual(uiCopyOverrides(customerUiCopyEl));
    expect(libKeys).toContain('timePicker.placeholder');
    expect(customerUiCopy()['timePicker.placeholder']).toBe('uiCopy.timePicker.placeholder');
    for (const key of libKeys) {
      expect(customerUiCopy()[key]).toBe(`${CUSTOMER_UI_COPY_BRANCH}.${key}`);
      expect(typeof read(customerUiCopyEl, key)).toBe('string');
    }
  });

  it('flattens nested branches and skips nothing', () => {
    expect(uiCopyOverrides({ a: { b: 'x', c: { d: 'y' } }, e: 'z' })).toEqual({
      'a.b': 'uiCopy.a.b',
      'a.c.d': 'uiCopy.a.c.d',
      e: 'uiCopy.e',
    });
  });

  it('has the same keys in Greek and English', () => {
    expect(Object.keys(uiCopyOverrides(customerUiCopyEn)).sort()).toEqual([...libKeys].sort());
  });

  it('is in the root dictionaries under the branch the map points to', () => {
    expect(el[CUSTOMER_UI_COPY_BRANCH]).toBe(customerUiCopyEl);
    expect(en[CUSTOMER_UI_COPY_BRANCH]).toBe(customerUiCopyEn);
  });

  it.each(libKeys)('overrides %s, a key the lib owns, with the same parameters', (key) => {
    const own = read(libEl, key);

    expect(typeof own).toBe('string');
    expect(params(read(customerUiCopyEl, key) as string)).toEqual(params(own as string));
  });

  it.each(libKeys)('keeps the lib English for %s', (key) => {
    expect(read(customerUiCopyEn, key)).toBe(read(libEn, key));
  });

  it('recognizes the polite plural', () => {
    expect(read(libEl, 'timePicker.errors.required')).toMatch(POLITE_VERB);
    expect(read(libEl, 'fileUpload.errors.network')).toMatch(POLITE_PRONOUN);
  });

  it.each(libKeys)('speaks the singular in %s', (key) => {
    const text = read(customerUiCopyEl, key) as string;

    expect(text).not.toMatch(POLITE_VERB);
    expect(text).not.toMatch(POLITE_PRONOUN);
  });
});
