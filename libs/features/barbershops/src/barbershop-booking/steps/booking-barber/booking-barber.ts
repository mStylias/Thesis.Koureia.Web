import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { LucideCheck, LucideUsers } from '@lucide/angular';
import { ActiveLanguage } from '@util/language';

import { BookingState } from '../../booking-state';
import { formatTotals } from '../../core/format-booking';
import { totalsFor } from '../../core/booking-catalog';
import type { BarberRow } from './booking-barber.types';

/**
 * Step 3: which barber.
 *
 * Anyone is first and is the default, because the soonest appointment matters more than the
 * name to most customers. Only barbers who perform **every** chosen service are listed — one who
 * could take half the booking is not an option.
 */
@Component({
  selector: 'lib-booking-barber',
  imports: [LucideCheck, LucideUsers, TranslocoPipe],
  templateUrl: './booking-barber.html',
  styleUrl: './booking-barber.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BookingBarber {
  private readonly language = inject(ActiveLanguage);

  protected readonly state = inject(BookingState);

  protected readonly rows = computed<readonly BarberRow[]>(() => {
    const options = this.state.options();
    if (options === null) return [];

    const serviceIds = this.state.serviceIds();
    const locale = this.language.value();
    const base = totalsFor(options, serviceIds, null);

    return this.state.barbers().map((barber) => {
      const totals = totalsFor(options, serviceIds, barber.id);
      // Stated only where it is news. Repeating the same price against every name turns the
      // step into a price list and buries the one barber who charges differently.
      const differs =
        !base.exact ||
        totals.price !== base.price ||
        totals.durationMinutes !== base.durationMinutes;

      return {
        id: barber.id,
        displayName: barber.displayName,
        initials: barber.initials,
        avatarUrl: barber.avatarUrl,
        totals: differs ? formatTotals(totals, options.currency, locale) : null,
      };
    });
  });
}
