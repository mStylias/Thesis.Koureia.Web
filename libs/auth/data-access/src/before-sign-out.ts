import { InjectionToken, type Provider } from '@angular/core';

import type { BeforeSignOut } from './before-sign-out.types';

/** The longest time sign-out waits for its hooks, all together. */
export const BEFORE_SIGN_OUT_LIMIT_MS = 2000;

/**
 * Hooks that `SessionStore.signOut()` runs first, while API calls still carry the token.
 *
 * A token and not an import, so that this library does not depend on a feature. Sign-out waits
 * {@link BEFORE_SIGN_OUT_LIMIT_MS} at most, and a hook that fails never stops it.
 */
export const BEFORE_SIGN_OUT = new InjectionToken<readonly BeforeSignOut[]>('BEFORE_SIGN_OUT');

/** Adds one hook. `factory` runs in an injection context. */
export function provideBeforeSignOut(factory: () => BeforeSignOut): Provider {
  return { provide: BEFORE_SIGN_OUT, multi: true, useFactory: factory };
}
