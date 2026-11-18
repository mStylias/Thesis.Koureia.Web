import { isPlatformBrowser } from '@angular/common';
import { PLATFORM_ID, Service, effect, inject, signal } from '@angular/core';

import { SessionStore } from './session-store';

/**
 * The shop a superadmin picked to work in. `companyScopeInterceptor` sends it as `X-Company-Id`.
 *
 * Kept in `sessionStorage`, so a reload keeps the shop and a new tab or browser session starts
 * with none. The API ignores the header from anyone who is not a superadmin, so a stale value on
 * another account does no harm. It is still cleared on sign-out.
 */
@Service()
export class WorkspaceCompanyChoice {
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private readonly session = inject(SessionStore);

  private readonly state = signal<string | null>(this.read());

  /** The picked shop id, or null when none is picked. */
  readonly companyId = this.state.asReadonly();

  constructor() {
    effect(() => {
      const status = this.session.status();
      if (status === 'signed-out' || status === 'expired') this.clear();
    });
  }

  set(companyId: string): void {
    this.state.set(companyId);
    this.write(companyId);
  }

  clear(): void {
    this.state.set(null);
    this.write(null);
  }

  private read(): string | null {
    if (!this.isBrowser) return null;

    try {
      const stored = sessionStorage.getItem(CHOICE_KEY);
      return stored === null || stored === '' ? null : stored;
    } catch {
      return null;
    }
  }

  private write(companyId: string | null): void {
    if (!this.isBrowser) return;

    try {
      if (companyId === null) {
        sessionStorage.removeItem(CHOICE_KEY);
      } else {
        sessionStorage.setItem(CHOICE_KEY, companyId);
      }
    } catch {
      // Private mode or a full quota. The pick holds for this page instead of failing.
    }
  }
}

const CHOICE_KEY = 'management.workspace-company';
