import type {
  AppointmentStatus,
  AppointmentStatusSpec,
  StatusAction,
} from './appointment-status.types';

/** The backend's `AppointmentStatus.All`, in the order the filters list them. */
export const APPOINTMENT_STATUSES = [
  'pending',
  'confirmed',
  'completed',
  'cancelled',
  'no_show',
] as const;

export const APPOINTMENT_STATUS_SPECS: Readonly<Record<AppointmentStatus, AppointmentStatusSpec>> =
  {
    pending: { tone: 'warning', muted: false },
    confirmed: { tone: 'info', muted: false },
    completed: { tone: 'success', muted: false },
    cancelled: { tone: 'neutral', muted: true },
    no_show: { tone: 'error', muted: true },
  };

/** The statuses that hold the barber's time. Only these can be edited in full or cancelled. */
const ACTIVE: readonly AppointmentStatus[] = ['pending', 'confirmed'];

/** The transitions of the spec's §9.1, except cancel. Nothing leaves `cancelled`. */
const ACTIONS: Readonly<Record<AppointmentStatus, readonly StatusAction[]>> = {
  pending: [
    {
      to: 'confirmed',
      label: 'managementAppointments.actions.confirm',
      afterStart: false,
      place: 'button',
    },
  ],
  confirmed: [
    {
      to: 'completed',
      label: 'managementAppointments.actions.complete',
      afterStart: true,
      place: 'icon',
    },
    {
      to: 'no_show',
      label: 'managementAppointments.actions.noShow',
      afterStart: true,
      place: 'icon',
    },
  ],
  completed: [
    {
      to: 'confirmed',
      label: 'managementAppointments.actions.restore',
      afterStart: false,
      place: 'icon',
    },
  ],
  no_show: [
    {
      to: 'confirmed',
      label: 'managementAppointments.actions.restore',
      afterStart: false,
      place: 'icon',
    },
  ],
  cancelled: [],
};

export function isAppointmentStatus(value: string): value is AppointmentStatus {
  return (APPOINTMENT_STATUSES as readonly string[]).includes(value);
}

/** Whether the status holds the barber's time: `pending` or `confirmed`. */
export function isActiveStatus(status: string): boolean {
  return isAppointmentStatus(status) && ACTIVE.includes(status);
}

/** The status changes a status allows, with `started` saying whether the start has passed. */
export function statusActions(status: string, started: boolean): readonly StatusAction[] {
  if (!isAppointmentStatus(status)) return [];
  return ACTIONS[status].filter((action) => started || !action.afterStart);
}

/** The translation key of a status label. */
export function statusLabelKey(status: AppointmentStatus): string {
  return `managementAppointments.status.${status}`;
}
