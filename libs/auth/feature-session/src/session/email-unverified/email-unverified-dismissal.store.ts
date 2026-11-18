import { isPlatformBrowser } from '@angular/common';
import { PLATFORM_ID, Service, inject, signal } from '@angular/core';

/**
 * Whether the unverified-address notice has been put away in this tab session.
 *
 * `sessionStorage` and not `localStorage`, on purpose. The notice is the only thing that tells an
 * unverified account it is unverified, so dismissal buys quiet for the visit and not forever:
 * closing the tab brings it back while the address is still unproven. It also keeps one tab's
 * dismissal out of the next tab, which may be where the person went to read the code.
 *
 * Nothing here runs outside the browser, so no server-rendered page carries one visitor's answer.
 */
@Service()
export class EmailUnverifiedDismissalStore {
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private readonly state = signal(this.read());

  readonly dismissed = this.state.asReadonly();

  dismiss(): void {
    this.state.set(true);
    if (!this.isBrowser) return;

    try {
      sessionStorage.setItem(DISMISSED_KEY, '1');
    } catch {
      // Private-mode quota refusal. The notice must still close, so it comes back on the next
      // load instead of refusing to go away now.
    }
  }

  /** Verification clears it, so a later sign-in as an unverified account is told again. */
  reset(): void {
    this.state.set(false);
    if (!this.isBrowser) return;

    try {
      sessionStorage.removeItem(DISMISSED_KEY);
    } catch {
      // Nothing to do and nothing worth failing for.
    }
  }

  private read(): boolean {
    if (!this.isBrowser) return false;

    try {
      return sessionStorage.getItem(DISMISSED_KEY) === '1';
    } catch {
      return false;
    }
  }
}

const DISMISSED_KEY = 'koureia.email-unverified-dismissed.v1';
