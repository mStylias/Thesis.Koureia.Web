import { Component } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { Banner } from '@ui/banner';
import { Switch } from '@ui/switch';
import { PageSection } from '@features/management-shared-page-sections';

/**
 * The Notifications card: a preview of the channels staff notifications will use. The switches
 * are disabled and off. Nothing is read and nothing is saved.
 *
 * The customer push setup is not shown here. A device that turned push on today gets only the
 * person's own customer reminders.
 */
@Component({
  selector: 'lib-profile-notifications',
  imports: [Banner, PageSection, Switch, TranslocoPipe],
  templateUrl: './profile-notifications.html',
  styleUrl: './profile-notifications.scss',
})
export class ProfileNotifications {
  protected readonly channels = ['email', 'platform', 'push'] as const;
}
