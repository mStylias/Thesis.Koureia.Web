import { BreakpointObserver } from '@angular/cdk/layout';
import { DOCUMENT, NgTemplateOutlet } from '@angular/common';
import { Component, computed, inject, linkedSignal, model } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { TranslocoPipe, provideTranslocoScope } from '@jsverse/transloco';
import {
  LucideBell,
  LucideEllipsis,
  LucideExternalLink,
  LucideLogIn,
  LucideRotateCw,
  LucideSettings,
  LucideShare,
  LucideSlidersHorizontal,
  LucideSquarePlus,
} from '@lucide/angular';
import { Button } from '@ui/button';
import { CopyButton } from '@ui/copy-button';
import { Dialog, DialogFooter } from '@ui/dialog';
import { Tab, TabList, TabPanel, Tabs } from '@ui/tabs';
import { BRAND } from '@util/brand';
import { map } from 'rxjs';

import type { PushOs } from '../core/push-environment.types';
import { PushReminders } from '../push-reminders';
import { remindersTranslocoScope } from '../reminders.i18n';
import type { ReminderGuideTopic } from './reminder-guide.types';

/** Below `sm` in `libs/shared/styles/src/abstracts/_scale.scss`. A Sass map is not readable here. */
const PHONE_QUERY = '(max-width: 639.98px)';

/**
 * How to get push working on this device, and on the others.
 *
 * ```html
 * <lib-reminder-guide [(visible)]="guideOpen" />
 * ```
 *
 * A sheet at the bottom of a phone, a dialog on a computer. It opens on this device's tab. The
 * topic follows the push state: the in-app browser, the iPhone Home Screen, or a blocked
 * permission.
 */
@Component({
  selector: 'lib-reminder-guide',
  imports: [
    Button,
    CopyButton,
    Dialog,
    DialogFooter,
    LucideBell,
    LucideEllipsis,
    LucideExternalLink,
    LucideLogIn,
    LucideRotateCw,
    LucideSettings,
    LucideShare,
    LucideSlidersHorizontal,
    LucideSquarePlus,
    NgTemplateOutlet,
    Tab,
    TabList,
    TabPanel,
    Tabs,
    TranslocoPipe,
  ],
  providers: [provideTranslocoScope(remindersTranslocoScope)],
  templateUrl: './reminder-guide.html',
  styleUrl: './reminder-guide.scss',
})
export class ReminderGuide {
  private readonly push = inject(PushReminders);
  private readonly document = inject(DOCUMENT);

  /** Open or closed. */
  readonly visible = model(false);

  protected readonly logo = inject(BRAND).logo;

  private readonly phone = toSignal(
    inject(BreakpointObserver)
      .observe(PHONE_QUERY)
      .pipe(map((state) => state.matches)),
    { initialValue: false },
  );

  protected readonly placement = computed(() => (this.phone() ? 'bottom' : 'center'));

  protected readonly topic = computed<ReminderGuideTopic>(() => {
    switch (this.push.state()) {
      case 'in-app-browser':
        return 'in-app';
      case 'needs-home-screen':
        return 'home-screen';
      default:
        return 'blocked';
    }
  });

  /** The selected tab. It starts on this device. */
  protected readonly device = linkedSignal<PushOs>(() => this.push.platform()?.os ?? 'desktop');

  /** An iPhone browser other than Safari must first open the page in Safari. */
  protected readonly safariFirst = computed(() => {
    const platform = this.push.platform();
    return platform?.os === 'ios' && platform.browser !== 'safari';
  });

  /** The Home Screen app with notifications refused. The steps are in the iPhone's Settings. */
  protected readonly iosBlocked = computed(
    () => this.topic() === 'blocked' && this.push.platform()?.os === 'ios',
  );

  protected pageUrl(): string {
    return this.document.location.href;
  }
}
