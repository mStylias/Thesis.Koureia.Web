import { NgTemplateOutlet } from '@angular/common';
import { Component, afterNextRender, computed, inject, linkedSignal, signal } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { UserProfileApi } from '@api/users';
import { LanguageSwitcher } from '@features/language';
import { PushReminders, ReminderGuide } from '@features/reminders';
import { Button } from '@ui/button';
import { Switch } from '@ui/switch';
import { ToasterService } from '@ui/toaster';
import { firstValueFrom } from 'rxjs';

import type { PushAction } from './account-settings.types';

const K = 'account.settings.reminders';

/**
 * The customer's preferences: appointment reminders, then the language.
 *
 * Reminder emails are a profile setting, saved on change. Push belongs to this browser: the
 * browser subscription is the setting, so the section shows the state of this device only.
 *
 * The language switcher stores the choice on the profile, which also sets the language of the
 * emails, and reloads the page in that language.
 */
@Component({
  selector: 'lib-account-settings',
  imports: [Button, LanguageSwitcher, NgTemplateOutlet, ReminderGuide, Switch, TranslocoPipe],
  templateUrl: './account-settings.html',
  styleUrl: './account-settings.scss',
})
export class AccountSettings {
  private readonly profiles = inject(UserProfileApi);
  private readonly push = inject(PushReminders);
  private readonly toaster = inject(ToasterService);
  private readonly transloco = inject(TranslocoService);

  private readonly profile = rxResource({ stream: () => this.profiles.current() });

  protected readonly pushState = this.push.state;
  protected readonly pushAction = signal<PushAction | null>(null);
  protected readonly guideOpen = signal(false);

  protected readonly profileReady = computed(() => this.profile.hasValue());
  protected readonly profileFailed = computed(() => this.profile.status() === 'error');
  protected readonly email = computed(() =>
    this.profile.hasValue() ? this.profile.value().email : '',
  );

  /** What the switch shows. It moves at once and goes back when the save fails. */
  protected readonly emailReminders = linkedSignal(() =>
    this.profile.hasValue() ? this.profile.value().emailRemindersEnabled : false,
  );

  constructor() {
    afterNextRender(() => {
      void this.push.check();
    });
  }

  protected retryProfile(): void {
    this.profile.reload();
  }

  protected async setEmailReminders(enabled: boolean): Promise<void> {
    this.emailReminders.set(enabled);
    const result = await firstValueFrom(this.profiles.update({ emailRemindersEnabled: enabled }));
    if (result.isSuccess) return;

    // Only when no later change replaced this one.
    if (this.emailReminders() === enabled) this.emailReminders.set(!enabled);
    this.toaster.error(this.transloco.translate(`${K}.emailFailed`));
  }

  /** Runs inside the click handler: the browser asks only after a user gesture. */
  protected async enablePush(): Promise<void> {
    if (!this.start('enable')) return;
    const outcome = await this.push.enable();
    this.pushAction.set(null);

    if (outcome === 'on') this.toaster.success(this.transloco.translate(`${K}.enabled`));
    if (outcome === 'failed') this.toaster.error(this.transloco.translate(`${K}.enableFailed`));
  }

  protected async disablePush(): Promise<void> {
    if (!this.start('disable')) return;
    await this.push.disable();
    this.pushAction.set(null);
    this.toaster.success(this.transloco.translate(`${K}.disabled`));
  }

  protected async sendTest(): Promise<void> {
    if (!this.start('test')) return;
    const outcome = await this.push.sendTest();
    this.pushAction.set(null);

    switch (outcome) {
      case 'sent':
        this.toaster.success(this.transloco.translate(`${K}.testSent`));
        break;
      case 'rate-limited':
        this.toaster.warning(this.transloco.translate(`${K}.testLimited`));
        break;
      case 'gone':
        this.toaster.warning(this.transloco.translate(`${K}.testGone`));
        break;
      case 'failed':
        this.toaster.error(this.transloco.translate(`${K}.testFailed`));
        break;
    }
  }

  /** One push action at a time. */
  private start(action: PushAction): boolean {
    if (this.pushAction() !== null) return false;
    this.pushAction.set(action);
    return true;
  }
}
