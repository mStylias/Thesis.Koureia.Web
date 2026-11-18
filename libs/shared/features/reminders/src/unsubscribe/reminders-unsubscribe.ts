import { Component, afterNextRender, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { TranslocoPipe, provideTranslocoScope } from '@jsverse/transloco';
import {
  EmailRemindersApi,
  REMINDERS_INVALID_TOKEN,
  type EmailReminderSubscriptionResponse,
} from '@api/reminders';
import type { Result } from '@synax/client/core';
import { Button } from '@ui/button';
import { ActiveLanguage, withLanguagePrefix } from '@util/language';
import { firstValueFrom, type Observable } from 'rxjs';

import { REMINDERS_ACCOUNT } from '../reminders-account';
import { remindersTranslocoScope } from '../reminders.i18n';
import type { UnsubscribeChange, UnsubscribeView } from './reminders-unsubscribe.types';

/**
 * The page an unsubscribe link opens, at `/{lang}/reminders/unsubscribe?token=…`. No sign-in.
 *
 * **Opening it only reads the token.** Mail scanners open links, so only a button press changes
 * anything. The mail app's own "Unsubscribe" button reaches the API without this page.
 */
@Component({
  selector: 'lib-reminders-unsubscribe',
  imports: [Button, RouterLink, TranslocoPipe],
  providers: [provideTranslocoScope(remindersTranslocoScope)],
  templateUrl: './reminders-unsubscribe.html',
  styleUrl: './reminders-unsubscribe.scss',
})
export class RemindersUnsubscribe {
  private readonly api = inject(EmailRemindersApi);
  private readonly language = inject(ActiveLanguage);
  private readonly account = inject(REMINDERS_ACCOUNT, { optional: true });
  private readonly token = inject(ActivatedRoute).snapshot.queryParamMap.get('token') ?? '';

  protected readonly view = signal<UnsubscribeView>({ status: 'loading' });
  protected readonly change = signal<UnsubscribeChange>('none');
  protected readonly saving = signal(false);
  protected readonly saveFailed = signal(false);

  /** A bad token cannot say whose it was, so a signed-in visitor gets Settings anyway. */
  protected readonly signedIn = computed(() => this.account?.signedIn() ?? false);

  protected readonly settingsLink = computed(() =>
    withLanguagePrefix('/account/settings', this.language.value()),
  );

  constructor() {
    afterNextRender(() => {
      void this.load();
    });
  }

  protected async load(): Promise<void> {
    if (this.token === '') {
      this.view.set({ status: 'invalid' });
      return;
    }
    this.view.set({ status: 'loading' });
    this.show(await firstValueFrom(this.api.read(this.token)));
  }

  protected stop(): Promise<void> {
    return this.write(this.api.unsubscribe(this.token), 'stopped');
  }

  protected resume(): Promise<void> {
    return this.write(this.api.resubscribe(this.token), 'resumed');
  }

  private async write(
    request: Observable<Result<EmailReminderSubscriptionResponse>>,
    change: UnsubscribeChange,
  ): Promise<void> {
    if (this.saving()) return;
    this.saving.set(true);
    this.saveFailed.set(false);
    const result = await firstValueFrom(request);
    this.saving.set(false);

    if (result.isSuccess || result.error.errorCode === REMINDERS_INVALID_TOKEN) {
      this.show(result);
      this.change.set(change);
      return;
    }
    this.saveFailed.set(true);
  }

  private show(result: Result<EmailReminderSubscriptionResponse>): void {
    if (result.isSuccess && result.data !== null) {
      this.view.set({ status: 'ready', subscription: result.data });
    } else if (!result.isSuccess && result.error.errorCode === REMINDERS_INVALID_TOKEN) {
      this.view.set({ status: 'invalid' });
    } else {
      this.view.set({ status: 'failed' });
    }
  }
}
