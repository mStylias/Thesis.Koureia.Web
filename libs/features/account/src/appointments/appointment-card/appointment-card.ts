import { Component, computed, inject, input, output } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import type { AppointmentResponse } from '@api/customer-appointments';
import { Button } from '@ui/button';
import { Card } from '@ui/card';
import { Rating } from '@ui/rating';
import { formatPrice, formatShopDate } from '@util/booking-format';
import { ActiveLanguage, LangLink } from '@util/language';

import { statusChip } from '../appointment-state';

/**
 * One appointment in the list. The shop name is the link to its page; "Rate this visit" is a
 * separate button, so the card holds no control inside another.
 */
@Component({
  selector: 'lib-appointment-card',
  imports: [Button, Card, LangLink, Rating, TranslocoPipe],
  templateUrl: './appointment-card.html',
  styleUrl: './appointment-card.scss',
})
export class AppointmentCard {
  private readonly language = inject(ActiveLanguage);

  readonly appointment = input.required<AppointmentResponse>();

  /** "Rate this visit" was pressed. */
  readonly rate = output<AppointmentResponse>();

  protected readonly link = computed(() => `/account/appointments/${this.appointment().id}`);

  protected readonly when = computed(() => {
    const appointment = this.appointment();
    return `${formatShopDate(appointment.localDate, this.language.value())}, ${appointment.localTime}`;
  });

  protected readonly services = computed(() =>
    this.appointment()
      .services.map((service) => service.name)
      .join(' + '),
  );

  protected readonly total = computed(() => {
    const appointment = this.appointment();
    return formatPrice(appointment.totalPrice, appointment.currency, this.language.value());
  });

  protected readonly status = computed(() => statusChip(this.appointment().status));

  /** The shop's first letter, for a shop with no logo. */
  protected readonly initial = computed(() => this.appointment().companyName.trim().charAt(0));
}
