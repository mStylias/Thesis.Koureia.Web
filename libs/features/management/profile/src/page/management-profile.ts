import { Component, inject } from '@angular/core';
import { provideTranslocoScope } from '@jsverse/transloco';
import {
  openPageAtFragment,
  PageEditors,
  providePageSections,
} from '@features/management-shared-page-sections';

import { ProfileAccount } from '../account/profile-account';
import { ProfileNotifications } from '../notifications/profile-notifications';
import { ProfilePreferences } from '../preferences/profile-preferences';
import { profileTranslocoScope } from '../profile.i18n';
import { ProfileWorkHours } from '../work/profile-work-hours';

/**
 * `/management/profile`: the signed-in person's own page. One column of cards that load and fail
 * on their own: Profile, Work hours, Preferences, Notifications.
 *
 * A card that edits registers with {@link PageEditors}, so one guard and one `beforeunload`
 * cover every card.
 */
@Component({
  selector: 'lib-management-profile',
  imports: [ProfileAccount, ProfileNotifications, ProfilePreferences, ProfileWorkHours],
  providers: [
    provideTranslocoScope(profileTranslocoScope),
    providePageSections({ discardMessage: 'managementProfile.discard.message' }),
  ],
  templateUrl: './management-profile.html',
  styleUrl: './management-profile.scss',
  host: { '(window:beforeunload)': 'onBeforeUnload($event)' },
})
export class ManagementProfile {
  private readonly editors = inject(PageEditors);

  constructor() {
    openPageAtFragment();
  }

  /** Called by the route's `canDeactivate`. */
  canLeave(): Promise<boolean> {
    return this.editors.canLeave();
  }

  protected onBeforeUnload(event: BeforeUnloadEvent): void {
    if (this.editors.hasChanges()) event.preventDefault();
  }
}
