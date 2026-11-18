import { InjectionToken } from '@angular/core';

import type { RemindersAccount } from './reminders-account.types';

/**
 * The session, as this library needs it.
 *
 * The session lives in `@auth/data-access`, which is `scope:auth`, and a `scope:shared` library
 * must not depend on it. The app provides this token from its `SessionStore`. Without it, push
 * never syncs, the Home Screen prompt never shows, and the unsubscribe page offers no Settings
 * link after a bad token.
 */
export const REMINDERS_ACCOUNT = new InjectionToken<RemindersAccount>('REMINDERS_ACCOUNT');
