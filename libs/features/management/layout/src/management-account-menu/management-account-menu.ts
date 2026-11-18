import { Component, computed, inject } from '@angular/core';
import { provideTranslocoScope, translateSignal } from '@jsverse/transloco';
import { LucideCircleUserRound, LucideLogOut, LucideStore, LucideUser } from '@lucide/angular';
import { SessionStore } from '@auth/data-access';
import { Button } from '@ui/button';
import { Menu, type MenuItem, MenuTrigger } from '@ui/menu';

import { managementTranslocoScope } from '../management.i18n';
import {
  MANAGEMENT_BASE_PATH,
  MANAGEMENT_COMPANY_PAGE,
  MANAGEMENT_PROFILE_PAGE,
} from '../management-pages';

/**
 * The account menu at the right end of the management top bar: the person's name, their profile,
 * the shop's settings and sign-out. The only way to sign out inside `/management`.
 *
 * ```html
 * <lib-management-account-menu />
 * ```
 */
@Component({
  selector: 'lib-management-account-menu',
  imports: [Button, LucideCircleUserRound, Menu, MenuTrigger],
  providers: [provideTranslocoScope(managementTranslocoScope)],
  template: `
    <button
      libButton
      type="button"
      variant="text"
      severity="secondary"
      size="md"
      iconOnly
      rounded
      [libMenuTriggerFor]="accountMenu"
      [attr.aria-label]="menuLabel()"
    >
      <svg lucideCircleUserRound aria-hidden="true"></svg>
    </button>
    <lib-menu #accountMenu [items]="items()" [ariaLabel]="menuLabel()" />
  `,
  styles: `
    :host {
      display: inline-flex;
      align-items: center;
    }

    svg {
      width: var(--icon-size-lg);
      height: var(--icon-size-lg);
      stroke-width: var(--icon-stroke);
    }
  `,
})
export class ManagementAccountMenu {
  private readonly session = inject(SessionStore);

  protected readonly menuLabel = translateSignal('account.menu');
  private readonly profileLabel = translateSignal('account.profile');
  private readonly companyLabel = translateSignal('account.company');
  private readonly signOutLabel = translateSignal('account.signOut');

  /** The name comes from the session, so a saved name shows after the session refreshes. */
  protected readonly items = computed<readonly MenuItem[]>(() => {
    const claims = this.session.claims();
    const name = [claims?.givenName, claims?.familyName].filter(Boolean).join(' ');

    return [
      ...(name === '' ? [] : [{ label: name, heading: true }]),
      {
        label: this.profileLabel(),
        icon: LucideUser,
        routerLink: `${MANAGEMENT_BASE_PATH}/${MANAGEMENT_PROFILE_PAGE}`,
      },
      {
        label: this.companyLabel(),
        icon: LucideStore,
        routerLink: `${MANAGEMENT_BASE_PATH}/${MANAGEMENT_COMPANY_PAGE}`,
      },
      { separator: true },
      {
        label: this.signOutLabel(),
        icon: LucideLogOut,
        command: () => {
          void this.session.signOut();
        },
      },
    ];
  });
}
