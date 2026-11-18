import type { DataKey } from '@ui/data-source';

/** Whether the customer is picked from the shop's customers or typed in as a walk-in. */
export type CustomerMode = 'existing' | 'new';

/** A walk-in's details. Only the first name is required. */
export interface NewCustomerFormValue {
  firstName: string;
  lastName: string;
  /** E.164, as `lib-phone-input` writes it. */
  phoneNumber: string;
  email: string;
}

/**
 * The drawer's form. Empty strings stand for "not chosen", which is what the pickers write.
 *
 * `endOverridden` is not a field. It records that the user typed the end, so the end stops
 * following the services. `manualTime` is not a field either. On a create it swaps the free-time
 * grid for the start and end pickers.
 */
export interface AppointmentFormValue {
  customerMode: CustomerMode;
  customerId: DataKey;
  newCustomer: NewCustomerFormValue;
  serviceIds: string[];
  staffMemberId: string;
  localDate: string;
  localStartTime: string;
  localEndTime: string;
  endOverridden: boolean;
  manualTime: boolean;
  internalNotes: string;
  notifyCustomer: boolean;
}
