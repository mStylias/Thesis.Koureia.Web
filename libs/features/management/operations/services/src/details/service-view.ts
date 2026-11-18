import { Component, input } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import type { ServiceResponse } from '@api/services';
import { Banner } from '@ui/banner';

import type { ServiceStaffView } from './service-details.types';

/**
 * One service, read: its names, category, status, price and time, and the barbers who offer it.
 * The drawer resolves the names the options hold, so this draws only what it is given.
 */
@Component({
  selector: 'lib-service-view',
  imports: [Banner, TranslocoPipe],
  templateUrl: './service-view.html',
  styleUrl: './service-view.scss',
})
export class ServiceView {
  readonly service = input.required<ServiceResponse>();

  /** The category's name in the page language, or "Uncategorized". */
  readonly categoryName = input.required<string>();

  /** The barbers who perform the service, with their own values. */
  readonly assigned = input.required<readonly ServiceStaffView[]>();

  /** Why online customers cannot book the service, or `null` when they can. */
  readonly notBookableReason = input.required<'inactive' | 'noBarbers' | null>();

  /** Formats a price in the shop's currency and the page language. */
  readonly money = input.required<Intl.NumberFormat>();
}
