import { Component, inject, signal } from '@angular/core';
import { ActivatedRoute, ActivatedRouteSnapshot, RouterOutlet } from '@angular/router';
import { HomeScreenPrompt } from '@features/reminders';

import { SiteFooter } from './site-footer/site-footer';

/**
 * A public page, the site footer below it, and the push prompt of the iPhone Home Screen app.
 *
 * A route opts out of the footer with `data: { siteFooter: false }`. The flag covers everything
 * below it.
 */
@Component({
  selector: 'lib-site-layout',
  imports: [HomeScreenPrompt, RouterOutlet, SiteFooter],
  template: `
    <router-outlet (activate)="updateFooter()" />
    @if (showFooter()) {
      <lib-site-footer />
    }
    <!-- The iPhone Home Screen app asks once per launch. Renders nothing anywhere else. -->
    <lib-reminder-home-screen-prompt />
  `,
  styleUrl: './site-layout.scss',
})
export class SiteLayout {
  private readonly route = inject(ActivatedRoute);

  protected readonly showFooter = signal(true);

  /** Runs on every page this outlet activates, which is every change of the flag. */
  protected updateFooter(): void {
    this.showFooter.set(!optsOutOfFooter(this.route.snapshot));
  }
}

function optsOutOfFooter(root: ActivatedRouteSnapshot): boolean {
  for (let route: ActivatedRouteSnapshot | null = root; route; route = route.firstChild) {
    if (route.data['siteFooter'] === false) return true;
  }
  return false;
}
