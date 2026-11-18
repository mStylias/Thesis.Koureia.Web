import { Component, computed, inject, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { provideTranslocoScope, TranslocoPipe, translateSignal } from '@jsverse/transloco';
import { SessionStore } from '@auth/data-access';
import { SiteHeader } from '@features/site-layout';
import { TabMenu, type TabMenuItem } from '@ui/tabs';
import { ActiveLanguage, withLanguagePrefix } from '@util/language';

import { accountTranslocoScope } from '../account.i18n';

/** The account area: the site header, the page heading, the routed tabs and the tab's page. */
@Component({
  selector: 'lib-account-shell',
  imports: [RouterOutlet, SiteHeader, TabMenu, TranslocoPipe],
  providers: [provideTranslocoScope(accountTranslocoScope)],
  templateUrl: './account-shell.html',
  styleUrl: './account-shell.scss',
})
export class AccountShell {
  private readonly session = inject(SessionStore);
  private readonly language = inject(ActiveLanguage);

  private readonly appointmentsLabel = translateSignal('shell.tabs.appointments');
  private readonly reviewsLabel = translateSignal('shell.tabs.reviews');
  private readonly profileLabel = translateSignal('shell.tabs.profile');
  private readonly settingsLabel = translateSignal('shell.tabs.settings');

  /** The routed page asks for the whole column. */
  protected readonly wide = signal(false);

  protected readonly firstName = computed(() => this.session.claims()?.givenName ?? '');

  /** Not exact, so the Appointments tab stays lit on one appointment's page. */
  protected readonly activeOptions = { exact: false };

  protected readonly tabs = computed<readonly TabMenuItem[]>(() => {
    const path = (target: string): string =>
      withLanguagePrefix(`/account/${target}`, this.language.value());

    return [
      { label: this.appointmentsLabel(), routerLink: path('appointments') },
      { label: this.reviewsLabel(), routerLink: path('reviews') },
      { label: this.profileLabel(), routerLink: path('profile') },
      { label: this.settingsLabel(), routerLink: path('settings') },
    ];
  });
}
