import type { CustomerResponse, UpdateCustomerRequest } from '@api/customers';
import type { FieldByCode } from '@synax/forms';
import { field, fields } from '@util/forms';

import type { CustomerFormValue } from './customer-details.form.types';

/** The API's limits. */
export const NAME_MAX_LENGTH = 100;
export const NOTE_MAX_LENGTH = 2000;

const K = 'managementCustomers.form';

export const CUSTOMER_FIELDS = fields<CustomerFormValue>({
  firstName: field({
    label: `${K}.firstName`,
    required: `${K}.errors.firstNameRequired`,
    maxLength: [NAME_MAX_LENGTH, `${K}.errors.nameTooLong`],
  }),
  lastName: field({
    label: `${K}.lastName`,
    maxLength: [NAME_MAX_LENGTH, `${K}.errors.nameTooLong`],
  }),
  phoneNumber: field({ label: `${K}.phone` }),
  email: field({ label: `${K}.email`, email: `${K}.errors.emailInvalid` }),
  note: field({
    label: `${K}.note`,
    maxLength: [NOTE_MAX_LENGTH, `${K}.errors.noteTooLong`],
  }),
  preferredStaffMemberId: field({ label: `${K}.preferredBarber` }),
});

/** The refusals that name a field by code. The API also sends property errors, placed as they come. */
export const CUSTOMER_ERROR_FIELDS: FieldByCode = {
  CUSTOMER_INVALID_PHONE: 'phoneNumber',
  CUSTOMER_INVALID_EMAIL: 'email',
  CUSTOMER_EMAIL_USED_BY_WALK_IN: 'email',
  CUSTOMER_EMAIL_USED_BY_ACCOUNT: 'email',
  CUSTOMER_INVALID_NOTE: 'note',
  CUSTOMER_INVALID_PREFERRED_STAFF: 'preferredStaffMemberId',
};

/** The form for a customer as saved. */
export function formFromCustomer(customer: CustomerResponse | null): CustomerFormValue {
  return {
    firstName: customer?.firstName ?? '',
    lastName: customer?.lastName ?? '',
    phoneNumber: customer?.phoneNumber ?? '',
    email: customer?.email ?? '',
    note: customer?.note?.text ?? '',
    preferredStaffMemberId: customer?.preferredStaffMemberId ?? '',
  };
}

/**
 * The merge-patch: only the members that differ from the saved customer. Another person's edit
 * of a different member therefore survives this save.
 *
 * Contact members are left out for an account holder, whose details are their own. An empty
 * note goes as `''`, which clears it. An empty name, phone or email goes as `null`.
 */
export function customerPatch(
  saved: CustomerResponse,
  value: CustomerFormValue,
): UpdateCustomerRequest {
  const before = formFromCustomer(saved);
  const changed = (key: keyof CustomerFormValue): boolean =>
    value[key].trim() !== before[key].trim();
  const orNull = (text: string): string | null => (text.trim() === '' ? null : text.trim());

  return {
    ...(saved.canEditContactDetails && changed('firstName')
      ? { firstName: value.firstName.trim() }
      : {}),
    ...(saved.canEditContactDetails && changed('lastName')
      ? { lastName: orNull(value.lastName) }
      : {}),
    ...(saved.canEditContactDetails && changed('phoneNumber')
      ? { phoneNumber: orNull(value.phoneNumber) }
      : {}),
    ...(saved.canEditContactDetails && changed('email') ? { email: orNull(value.email) } : {}),
    ...(changed('note') ? { note: value.note.trim() } : {}),
    ...(changed('preferredStaffMemberId')
      ? { preferredStaffMemberId: orNull(value.preferredStaffMemberId) }
      : {}),
  };
}
