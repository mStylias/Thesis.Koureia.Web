export { AppointmentDetails } from './details/appointment-details';
export {
  PREFILL_PARAMS,
  appointmentDetailsChanged,
  leaveAppointmentDetails,
  panelSwap,
} from './details/appointment-details.guard';
export {
  APPOINTMENT_PANEL_HOST,
  APPOINTMENTS_PAGE,
  CUSTOMER_PARAM,
  NEW_APPOINTMENT,
} from './host/appointment-panel-host';
export { prefillEqual, prefillParams, readPrefill } from './host/appointment-prefill';
export { appointmentsInlineLoader, appointmentsTranslocoScope } from './appointments.i18n';
export {
  APPOINTMENT_STATUSES,
  APPOINTMENT_STATUS_SPECS,
  isActiveStatus,
  isAppointmentStatus,
  statusActions,
  statusLabelKey,
} from './appointment-status';
export { customerSearchTerm, customersSource } from './data/customers-source';
export { CustomerHistory } from './view/customer-history';

export type {
  AppointmentStatus,
  AppointmentStatusSpec,
  SettableStatus,
  StatusAction,
  StatusActionPlace,
} from './appointment-status.types';
export type { OpenAppointment } from './view/customer-history.types';
export type {
  AppointmentPanelHost,
  AppointmentPrefill,
  PanelStaffMember,
} from './host/appointment-panel-host.types';
