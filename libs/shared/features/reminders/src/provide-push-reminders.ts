import {
  type EnvironmentProviders,
  inject,
  makeEnvironmentProviders,
  provideAppInitializer,
} from '@angular/core';

import { PushReminders } from './push-reminders';

/**
 * Starts the push sync with the app. The app must also provide `REMINDERS_ACCOUNT`, and register
 * {@link PushReminders.disable} as a sign-out hook, so a shared computer does not show one
 * person's reminders to the next.
 */
export function providePushReminders(): EnvironmentProviders {
  return makeEnvironmentProviders([
    provideAppInitializer(() => {
      inject(PushReminders).start();
    }),
  ]);
}
