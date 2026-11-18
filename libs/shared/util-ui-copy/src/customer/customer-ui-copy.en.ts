import type { CustomerUiCopy } from './customer-ui-copy.types';

/**
 * The English of the customer copy. English has no polite plural, so each value is the lib's own
 * English text. The type holds it to the Greek keys.
 */
export const customerUiCopyEn: CustomerUiCopy = {
  confirmationDialog: {
    message: 'Are you sure you want to continue?',
  },
  datePicker: {
    calendar: 'Choose a date',
    errors: {
      required: 'Choose a date.',
      dateFormat: 'Enter a valid date using the shown format.',
      dateUnavailable: 'Choose one of the available dates.',
    },
  },
  dateRangePicker: {
    panel: 'Choose a date range',
    pickEnd: 'Choose the last day',
    errors: {
      required: 'Choose a date range.',
      dateFormat: 'Enter valid dates using the shown format.',
      dateUnavailable: 'Choose dates within the available limits.',
    },
  },
  datetimePicker: {
    placeholder: 'Choose a date',
    panel: 'Choose a date and optional time',
  },
  fileUpload: {
    dropHint: 'Drag and drop files here, or use the button',
    errors: {
      network: 'The upload could not reach the server. Check your connection and try again',
      unknown: 'The file could not be uploaded. Try again',
      required: 'Add at least one file',
    },
  },
  field: {
    errors: {
      email: 'Enter a valid email address',
      minLength: 'Use at least {{minLength}} characters',
      maxLength: 'Use at most {{maxLength}} characters',
      min: 'Enter {{min}} or more',
      max: 'Enter {{max}} or less',
      minDate: 'Choose a later date',
      maxDate: 'Choose an earlier date',
    },
  },
  imageCropper: {
    hint: 'Drag the photo or use the arrow keys. Zoom with the slider or with + and −.',
  },
  inputNumber: {
    errors: {
      required: 'Enter a number.',
      min: 'Enter {{min}} or more.',
      max: 'Enter {{max}} or less.',
      invalid: 'Enter a valid number.',
    },
  },
  inputOtp: {
    errors: {
      required: 'Enter the code.',
      minLength: 'Fill in every digit of the code.',
    },
  },
  multiSelect: {
    typeToSearch: 'Type to search',
  },
  passwordInput: {
    strength: {
      none: 'Enter a password',
    },
  },
  phoneInput: {
    errors: {
      phoneGreekMobile: 'Enter a valid Greek mobile number (starting with 69)',
    },
  },
  rangePicker: {
    errors: {
      required: 'Choose a range.',
      invalid: 'Choose a valid range.',
      min: 'Choose a minimum of {{min}} or more.',
      max: 'Choose a maximum of {{max}} or less.',
    },
  },
  select: {
    typeToSearch: 'Type to search',
  },
  timePicker: {
    placeholder: 'Select or type a time',
    errors: {
      required: 'Choose a time.',
      timeFormat: 'Enter a valid time, for example 09:30.',
      timeUnavailable: 'Choose one of the available times.',
    },
  },
};
