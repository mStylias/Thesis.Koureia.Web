import { DOCUMENT, isPlatformBrowser } from '@angular/common';
import { PLATFORM_ID, Service, inject } from '@angular/core';
import { Router } from '@angular/router';
import { SessionStore, StaffAccessStore } from '@auth/data-access';

import { MANAGEMENT_PREFIX, isManagementUrl } from './management-entry.store';

/**
 * Sends staff to the workspace when they sign in. A customer stays on the page they signed in
 * from.
 *
 * It runs in the browser after the callback, because the server does not know who is staff. The
 * page that sign-in returns to shows until the workspace read answers.
 */
@Service()
export class StaffSignInRedirect {
  private readonly session = inject(SessionStore);
  private readonly access = inject(StaffAccessStore);
  private readonly router = inject(Router);
  private readonly document = inject(DOCUMENT);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  /** Called once from `provideAppInitializer`. */
  start(): void {
    if (!this.isBrowser) return;
    // Read now, not after the session decision: the mark is cleared either way, so a cancelled
    // sign-in cannot redirect a later page load.
    if (!this.session.consumeFreshSignIn()) return;
    void this.redirect();
  }

  private async redirect(): Promise<void> {
    await this.session.whenReady();
    if (!this.session.isSignedIn()) return;

    await this.access.resolve();
    if (!this.access.canOpenWorkspace()) return;
    // A sign-in that the workspace guard started already returns there.
    if (isManagementUrl(this.document.location.pathname)) return;

    await this.router.navigateByUrl(MANAGEMENT_PREFIX);
  }
}
