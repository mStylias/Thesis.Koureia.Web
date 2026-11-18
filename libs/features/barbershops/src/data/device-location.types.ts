/** The shapes of the device-location wrapper. */

/**
 * Why the device could not say where it is.
 *
 * `denied` is terminal for the session: the browser answers it without prompting again, so the
 * control must stop asking and explain instead. The other two are worth another try.
 */
export type DeviceLocationFailure = 'denied' | 'unavailable' | 'timeout';

/** A point the device reported. Accuracy is deliberately absent — nothing here filters on it. */
export interface DeviceLocation {
  readonly latitude: number;
  readonly longitude: number;
}
