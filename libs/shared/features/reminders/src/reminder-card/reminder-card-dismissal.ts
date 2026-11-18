import { DOCUMENT } from '@angular/common';
import { Service, inject } from '@angular/core';

const STORAGE_KEY = 'reminders.cardDismissedAt';
const DISMISSAL_MS = 30 * 24 * 60 * 60 * 1000;

/**
 * "Not now" on the success card, remembered on this browser for 30 days.
 *
 * Without storage, in a private window or with site data blocked, the card shows again next time.
 */
@Service()
export class ReminderCardDismissal {
  private readonly window = inject(DOCUMENT).defaultView;

  isDismissed(now = Date.now()): boolean {
    try {
      const stored = this.window?.localStorage.getItem(STORAGE_KEY);
      if (stored === null || stored === undefined) return false;
      const at = Number(stored);
      return Number.isFinite(at) && now - at < DISMISSAL_MS;
    } catch {
      return false;
    }
  }

  dismiss(now = Date.now()): void {
    try {
      this.window?.localStorage.setItem(STORAGE_KEY, String(now));
    } catch {
      // No storage. The card shows again next time.
    }
  }
}
