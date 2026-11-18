import type { CalendarBadgeTone } from '@ui/calendar';
import type { APPOINTMENT_STATUSES } from './appointment-status';

/** A status code of the backend's `AppointmentStatus`. */
export type AppointmentStatus = (typeof APPOINTMENT_STATUSES)[number];

/** How a status is drawn on a tile and a badge. */
export interface AppointmentStatusSpec {
  readonly tone: CalendarBadgeTone;
  /** Cancelled and no-show appointments are drawn desaturated, with the time struck through. */
  readonly muted: boolean;
}

/** A status the status endpoint can set. Cancel has its own endpoint. */
export type SettableStatus = 'confirmed' | 'completed' | 'no_show';

/** One status change the drawer offers, and the copy of its button. */
export interface StatusAction {
  readonly to: SettableStatus;
  /** Translation key of the button. */
  readonly label: string;
  /** Allowed only once the start has passed in shop time. */
  readonly afterStart: boolean;
  /** Where the drawer draws it. */
  readonly place: StatusActionPlace;
}

/**
 * `button` has a label. `icon` is an icon button that moves into the ⋮ menu when the toolbar has
 * no room. `menu` is always in the ⋮ menu.
 */
export type StatusActionPlace = 'button' | 'icon' | 'menu';
