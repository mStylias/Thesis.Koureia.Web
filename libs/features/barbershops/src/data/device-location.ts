import { Service } from '@angular/core';

import type { DeviceLocation, DeviceLocationFailure } from './device-location.types';

/** How long to wait for a fix before giving up. Long enough for a cold GPS, short enough to end. */
const FIX_TIMEOUT_MS = 10_000;

/**
 * A fix this old is good enough.
 *
 * Reusing one the browser already has answers instantly and costs no radio. Two minutes cannot
 * move anybody far enough to change which barbershop is nearest.
 */
const FIX_MAX_AGE_MS = 120_000;

/** The device could not say where it is. */
export class DeviceLocationError extends Error {
  constructor(readonly kind: DeviceLocationFailure) {
    super(`Device location failed: ${kind}`);
    this.name = 'DeviceLocationError';
  }
}

/**
 * The browser's own Geolocation API, as a promise.
 *
 * No provider call and no network: the device answers. This is why the locate action keeps
 * working when place search does not.
 */
@Service()
export class DeviceLocator {
  /**
   * Whether asking is possible at all.
   *
   * False during a server render, and false on an insecure origin, where every browser refuses
   * the API outright. Callers must read this after hydration — a control shown or hidden from
   * a server-rendered guess would be wrong for half the visitors.
   */
  available(): boolean {
    return (
      typeof navigator !== 'undefined' &&
      'geolocation' in navigator &&
      typeof window !== 'undefined' &&
      window.isSecureContext
    );
  }

  /**
   * Asks the device where it is.
   *
   * The browser raises its permission prompt here and nowhere else, so this must only ever be
   * reached from something the visitor pressed. Prompting on load trains people to refuse, and
   * a refusal is remembered for the origin.
   */
  locate(): Promise<DeviceLocation> {
    if (!this.available()) {
      return Promise.reject(new DeviceLocationError('unavailable'));
    }

    return new Promise<DeviceLocation>((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          resolve({
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
          });
        },
        (error) => {
          reject(new DeviceLocationError(failureOf(error)));
        },
        {
          enableHighAccuracy: false,
          timeout: FIX_TIMEOUT_MS,
          maximumAge: FIX_MAX_AGE_MS,
        },
      );
    });
  }
}

function failureOf(error: GeolocationPositionError): DeviceLocationFailure {
  if (error.code === error.PERMISSION_DENIED) return 'denied';
  if (error.code === error.TIMEOUT) return 'timeout';
  return 'unavailable';
}
