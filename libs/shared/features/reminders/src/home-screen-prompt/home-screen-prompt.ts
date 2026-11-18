import { DOCUMENT } from '@angular/common';
import { Component, afterNextRender, effect, inject, signal, untracked } from '@angular/core';
import { TranslocoPipe, TranslocoService, provideTranslocoScope } from '@jsverse/transloco';
import { Button } from '@ui/button';
import { Dialog, DialogFooter } from '@ui/dialog';
import { ToasterService } from '@ui/toaster';

import { PushBrowser } from '../push-browser';
import { PushReminders } from '../push-reminders';
import { REMINDERS_ACCOUNT } from '../reminders-account';
import { remindersTranslocoScope } from '../reminders.i18n';

/** Set for the rest of the launch. A Home Screen app starts a new session each time it opens. */
const PROMPTED_KEY = 'reminders.homeScreenPrompted';

/**
 * The offer to turn push on, the first time the iPhone Home Screen app has a signed-in customer.
 *
 * ```html
 * <lib-reminder-home-screen-prompt />
 * ```
 *
 * Once per launch, and only while the state is `available`. The button press is the gesture that
 * the browser question needs. The site layout renders it on every public page.
 */
@Component({
  selector: 'lib-reminder-home-screen-prompt',
  imports: [Button, Dialog, DialogFooter, TranslocoPipe],
  providers: [provideTranslocoScope(remindersTranslocoScope)],
  templateUrl: './home-screen-prompt.html',
  styleUrl: './home-screen-prompt.scss',
})
export class HomeScreenPrompt {
  private readonly push = inject(PushReminders);
  private readonly browser = inject(PushBrowser);
  private readonly account = inject(REMINDERS_ACCOUNT, { optional: true });
  private readonly window = inject(DOCUMENT).defaultView;
  private readonly toaster = inject(ToasterService);
  private readonly transloco = inject(TranslocoService);

  protected readonly visible = signal(false);
  protected readonly enabling = signal(false);

  /** Only the Home Screen app on an iPhone or iPad. Everyone else is left alone. */
  protected readonly homeScreenApp = signal(false);

  /** The launch flag when `sessionStorage` throws. */
  private memoryPrompted = false;

  constructor() {
    afterNextRender(() => {
      const environment = this.browser.environment();
      if (environment?.os !== 'ios' || !environment.standalone || this.prompted()) return;
      this.homeScreenApp.set(true);
      void this.push.check();
    });

    effect(() => {
      if (!this.homeScreenApp() || this.account?.verified() !== true) return;
      if (this.push.state() !== 'available') return;
      untracked(() => {
        if (this.prompted()) return;
        this.markPrompted();
        this.visible.set(true);
      });
    });
  }

  protected async enable(): Promise<void> {
    if (this.enabling()) return;
    this.enabling.set(true);
    const outcome = await this.push.enable();
    this.enabling.set(false);
    this.visible.set(false);

    if (outcome === 'on') this.toaster.success(this.transloco.translate('reminders.outcome.on'));
    if (outcome === 'failed') {
      this.toaster.error(this.transloco.translate('reminders.outcome.failed'));
    }
  }

  private prompted(): boolean {
    try {
      return this.window?.sessionStorage.getItem(PROMPTED_KEY) !== null || this.memoryPrompted;
    } catch {
      return this.memoryPrompted;
    }
  }

  private markPrompted(): void {
    this.memoryPrompted = true;
    try {
      this.window?.sessionStorage.setItem(PROMPTED_KEY, '1');
    } catch {
      // No storage. The flag in memory lasts until the next page load.
    }
  }
}
