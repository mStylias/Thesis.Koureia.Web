import type { Signal } from '@angular/core';

/** The half of the session this library reads. The app supplies it. See `REMINDERS_ACCOUNT`. */
export interface RemindersAccount {
  /** Someone is signed in. */
  readonly signedIn: Signal<boolean>;
  /** A signed-in person with a verified email. The `/users/me` push routes accept only them. */
  readonly verified: Signal<boolean>;
}
