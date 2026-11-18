import { Component, computed, input } from '@angular/core';
import type { UrlTree } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { LucidePhone, LucideTriangleAlert } from '@lucide/angular';
import type { CustomerResponse } from '@api/customers';
import { CustomerHistory, type OpenAppointment } from '@features/management-shared-appointments';
import { Banner } from '@ui/banner';
import { Button, ButtonIcon } from '@ui/button';
import { CopyButton } from '@ui/copy-button';
import { Stat, StatGroup } from '@ui/stat';
import { Tooltip } from '@ui/tooltip';

import { NO_SHOW_WARNING } from '../customers.columns';
import { formatDay, formatInstant } from '../customers.format';

/**
 * One customer, read: the block, how to reach them, the shop's note, the preferred barber, their
 * numbers and their appointments. The drawer's toolbar holds the actions, so nothing here edits.
 * A section with nothing to show is left out.
 */
@Component({
  selector: 'lib-customer-view',
  imports: [
    Banner,
    Button,
    ButtonIcon,
    CopyButton,
    CustomerHistory,
    LucidePhone,
    LucideTriangleAlert,
    Stat,
    StatGroup,
    Tooltip,
    TranslocoPipe,
  ],
  templateUrl: './customer-view.html',
  styleUrl: './customer-view.scss',
})
export class CustomerView {
  readonly customer = input.required<CustomerResponse>();
  readonly language = input.required<string>();
  /** The shop's zone, which the instants are written in. */
  readonly timezone = input.required<string>();
  /** Whether the caller holds `analytics:read`. Without it the drawer shows no money. */
  readonly canSeeSpend = input(false);
  /** The appointment list needs `appointments:read_all`. `false` leaves it out. */
  readonly canReadAppointments = input(false);
  /** Bumped by every write, so the appointment list follows a merge. */
  readonly revision = input(0);
  /** Where the list's "View all" goes. */
  readonly appointmentsLink = input<UrlTree | null>(null);
  /** Where an appointment of the list opens. */
  readonly appointmentLink = input<((appointment: OpenAppointment) => UrlTree) | null>(null);

  protected readonly warnNoShows = computed(() => this.customer().noShowCount >= NO_SHOW_WARNING);

  /** `tel:` wants the number without spaces. */
  protected readonly phoneHref = computed(() => {
    const phone = this.customer().phoneNumber;
    return phone === null ? null : `tel:${phone.replace(/\s+/g, '')}`;
  });

  protected readonly money = computed(
    () => new Intl.NumberFormat(this.language(), { style: 'currency', currency: 'EUR' }),
  );

  protected readonly totalSpend = computed(() => this.amount(this.customer().totalSpend));
  protected readonly averageSpend = computed(() => this.amount(this.customer().averageSpend));

  protected day(value: string | null): string {
    return value === null ? '' : formatDay(value, this.language());
  }

  protected instant(value: string | null): string {
    return value === null ? '' : formatInstant(value, this.language(), this.timezone());
  }

  /** `''` without the right or without an amount: the API sends `null`, never `0`, then. */
  private amount(value: number | null): string {
    return !this.canSeeSpend() || value === null ? '' : this.money().format(value);
  }
}
