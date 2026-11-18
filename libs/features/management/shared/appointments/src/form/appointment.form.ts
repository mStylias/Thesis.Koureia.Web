import type { FieldByCode } from '@synax/forms';
import { field, fields, group } from '@util/forms';

import type { AppointmentFormValue } from './appointment.form.types';

export const NAME_MAX_LENGTH = 100;
export const EMAIL_MAX_LENGTH = 254;
export const NOTE_MAX_LENGTH = 1000;
export const REASON_MAX_LENGTH = 500;

const K = 'managementAppointments.form';

/** The fields' copy and the limits the spec can express. The rest is in the form's `rules`. */
export const APPOINTMENT_FIELDS = fields<AppointmentFormValue>({
  customerId: field({ label: `${K}.customer`, required: `${K}.errors.customerRequired` }),
  newCustomer: group({
    firstName: field({
      label: `${K}.firstName`,
      required: `${K}.errors.firstNameRequired`,
      maxLength: [NAME_MAX_LENGTH, `${K}.errors.tooLong`],
    }),
    lastName: field({
      label: `${K}.lastName`,
      maxLength: [NAME_MAX_LENGTH, `${K}.errors.tooLong`],
    }),
    phoneNumber: field({ label: `${K}.phone` }),
    email: field({
      label: `${K}.email`,
      email: `${K}.errors.emailInvalid`,
      maxLength: [EMAIL_MAX_LENGTH, `${K}.errors.tooLong`],
    }),
  }),
  serviceIds: field({ label: `${K}.services` }),
  staffMemberId: field({ label: `${K}.barber`, required: `${K}.errors.barberRequired` }),
  localDate: field({ label: `${K}.date`, required: `${K}.errors.dateRequired` }),
  localStartTime: field({ label: `${K}.start`, required: `${K}.errors.startRequired` }),
  localEndTime: field({ label: `${K}.end` }),
  internalNotes: field({
    label: `${K}.internalNote`,
    hint: `${K}.internalNoteHint`,
    maxLength: [NOTE_MAX_LENGTH, `${K}.errors.noteTooLong`],
  }),
  notifyCustomer: field({ label: `${K}.notify` }),
});

/** The refusals that name a field by code. The API also sends property errors, placed as they come. */
export const APPOINTMENT_ERROR_FIELDS: FieldByCode = {
  CUSTOMER_NOT_FOUND: 'customerId',
  CUSTOMER_INVALID_NAME: 'newCustomer.firstName',
  CUSTOMER_INVALID_PHONE: 'newCustomer.phoneNumber',
  CUSTOMER_INVALID_EMAIL: 'newCustomer.email',
  APPOINTMENT_INVALID_SERVICES: 'serviceIds',
  APPOINTMENT_STAFF_UNAVAILABLE: 'staffMemberId',
  APPOINTMENT_INVALID_START: 'localStartTime',
  APPOINTMENT_SLOT_TAKEN: 'localStartTime',
  APPOINTMENT_INVALID_END: 'localEndTime',
  APPOINTMENT_INVALID_NOTES: 'internalNotes',
};

/** Every code the drawer has its own copy for, under `managementAppointments.errors`. */
export const APPOINTMENT_ERROR_CODES = [
  'APPOINTMENT_NOT_FOUND',
  'CUSTOMER_NOT_FOUND',
  'APPOINTMENT_INVALID_SERVICES',
  'APPOINTMENT_INVALID_START',
  'APPOINTMENT_INVALID_END',
  'APPOINTMENT_INVALID_NOTES',
  'CUSTOMER_INVALID_NAME',
  'CUSTOMER_INVALID_PHONE',
  'CUSTOMER_INVALID_EMAIL',
  'CUSTOMER_EMAIL_TAKEN',
  'APPOINTMENT_STAFF_UNAVAILABLE',
  'APPOINTMENT_SLOT_TAKEN',
  'APPOINTMENT_NOT_EDITABLE',
  'APPOINTMENT_INVALID_TRANSITION',
  'CANCELLATION_INVALID_REASON',
] as const;

/** A form with nothing chosen. */
export function emptyAppointmentForm(): AppointmentFormValue {
  return {
    customerMode: 'existing',
    customerId: '',
    newCustomer: { firstName: '', lastName: '', phoneNumber: '', email: '' },
    serviceIds: [],
    staffMemberId: '',
    localDate: '',
    localStartTime: '',
    localEndTime: '',
    endOverridden: false,
    manualTime: false,
    internalNotes: '',
    notifyCustomer: true,
  };
}
