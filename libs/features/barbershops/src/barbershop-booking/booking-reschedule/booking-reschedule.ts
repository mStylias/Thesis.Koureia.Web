import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import type { AppointmentPriceChange } from '@api/customer-appointments';
import { ActiveLanguage } from '@util/language';

import { BookingState } from '../booking-state';
import type { RescheduleRow } from '../booking.types';
import { formatPrice, formatShopDate } from '../core/format-booking';

/**
 * The confirm step of a move: the appointment as it is, beside what it becomes. A row whose two
 * sides agree is still shown, so the customer sees the whole appointment they confirm.
 */
@Component({
  selector: 'lib-booking-reschedule',
  imports: [TranslocoPipe],
  templateUrl: './booking-reschedule.html',
  styleUrl: './booking-reschedule.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BookingReschedule {
  private readonly state = inject(BookingState);
  private readonly language = inject(ActiveLanguage);

  /** A total the server named when the confirmed one went stale. It replaces the quote. */
  readonly newTotal = input<AppointmentPriceChange | null>(null);

  protected readonly rows = computed<readonly RescheduleRow[]>(() => {
    const booked = this.state.rescheduling();
    if (booked === null) return [];

    const locale = this.language.value();
    const date = this.state.date();
    const time = this.state.time();
    const changed = this.newTotal();
    const currency = changed?.currency ?? booked.currency;

    return [
      {
        label: 'barbershops.booking.summary.when',
        before: `${formatShopDate(booked.localDate, locale, true)}, ${booked.localTime}`,
        after:
          date === null || time === null ? null : `${formatShopDate(date, locale, true)}, ${time}`,
      },
      {
        label: 'barbershops.booking.summary.barber',
        before: booked.staffDisplayName,
        after: this.state.chosenBarber()?.displayName ?? null,
        afterKey: this.state.staffMemberId() === null ? 'barbershops.booking.barber.anyone' : null,
      },
      {
        label: 'barbershops.booking.summary.services',
        before: booked.services.map((service) => service.name).join(' + '),
        after: this.state
          .chosen()
          .map((service) => service.name)
          .join(' + '),
      },
      {
        label: 'barbershops.booking.summary.total',
        before: formatPrice(booked.totalPrice, booked.currency, locale),
        after: formatPrice(changed?.totalPrice ?? this.state.totals().price, currency, locale),
      },
    ];
  });
}
