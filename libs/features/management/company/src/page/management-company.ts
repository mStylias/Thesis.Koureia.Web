import { Component, inject } from '@angular/core';
import { provideTranslocoScope } from '@jsverse/transloco';
import {
  openPageAtFragment,
  PageEditors,
  providePageSections,
} from '@features/management-shared-page-sections';

import { CompanyBookingRules } from '../booking/company-booking-rules';
import { CompanyClosures } from '../closures/company-closures';
import { companyTranslocoScope } from '../company.i18n';
import { CompanyStore } from '../company.store';
import { CompanyHours } from '../hours/company-hours';
import { CompanyPhotos } from '../photos/company-photos';
import { CompanyShop } from '../shop/company-shop';

/**
 * `/management/company`: the shop's own settings. One column of cards that load and fail on
 * their own: Shop, Opening hours, Closures and special hours, Booking rules, Photos.
 *
 * Every member can read it. Only holders of `company:update` see the change actions. A card that
 * edits registers with {@link PageEditors}, so one guard and one `beforeunload` cover every card.
 */
@Component({
  selector: 'lib-management-company',
  imports: [CompanyBookingRules, CompanyClosures, CompanyHours, CompanyPhotos, CompanyShop],
  providers: [
    provideTranslocoScope(companyTranslocoScope),
    providePageSections({ discardMessage: 'managementCompany.discard.message' }),
    CompanyStore,
  ],
  templateUrl: './management-company.html',
  styleUrl: './management-company.scss',
  host: { '(window:beforeunload)': 'onBeforeUnload($event)' },
})
export class ManagementCompany {
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
