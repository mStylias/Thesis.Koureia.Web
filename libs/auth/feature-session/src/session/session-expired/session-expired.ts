import { Component, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { TranslocoPipe, provideTranslocoScope } from '@jsverse/transloco';
import { SessionStore } from '@auth/data-access';
import { Button } from '@ui/button';
import { Dialog, DialogFooter } from '@ui/dialog';

import { sessionTranslocoScope } from '../session.i18n';

/**
 * Expiry in the middle of a task, as a designed state.
 *
 * An expired or revoked session reaches the app as a failed renew, not as an error on the task.
 * So this explains what happened and offers the way back to the current page, not the home page.
 *
 * The app shell renders it on `status() === 'expired'`. Closing it means carry on signed out:
 * public pages still work, and a modal with no exit is its own broken screen.
 */
@Component({
  selector: 'auth-session-expired',
  imports: [Button, Dialog, DialogFooter, TranslocoPipe],
  providers: [provideTranslocoScope(sessionTranslocoScope)],
  template: `
    <lib-dialog
      [(visible)]="visible"
      [header]="'auth.expired.title' | transloco"
      [ariaDescribedBy]="bodyId"
      size="sm"
      (closed)="carryOnSignedOut()"
    >
      <p [id]="bodyId">{{ 'auth.expired.body' | transloco }}</p>

      <ng-template libDialogFooter>
        <button libButton type="button" (click)="signInAgain()">
          {{ 'auth.expired.signIn' | transloco }}
        </button>
      </ng-template>
    </lib-dialog>
  `,
})
export class SessionExpired {
  private readonly session = inject(SessionStore);
  private readonly router = inject(Router);

  protected readonly visible = signal(true);
  protected readonly bodyId = 'auth-session-expired-body';

  protected signInAgain(): void {
    // The current URL, so the round trip through Keycloak returns to the task.
    this.session.signIn(this.router.url);
  }

  protected carryOnSignedOut(): void {
    this.session.dismissExpired();
  }
}
