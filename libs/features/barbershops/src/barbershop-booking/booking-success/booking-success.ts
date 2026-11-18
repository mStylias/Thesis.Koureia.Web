import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { TranslocoPipe, provideTranslocoScope } from '@jsverse/transloco';
import { LucideCalendarCheck } from '@lucide/angular';
import { CustomerAppointmentsApi } from '@api/customer-appointments';
import { ReminderCard } from '@features/reminders';
import { Banner } from '@ui/banner';
import { Button } from '@ui/button';
import { ActiveLanguage, withLanguagePrefix } from '@util/language';

import { barbershopsTranslocoScope } from '../../barbershops.i18n';
import { formatDuration, formatPrice, formatShopDate } from '../core/format-booking';

/**
 * What the customer sees once the appointment exists.
 *
 * Its own route, `/barbershops/{slug}/booking/{id}`, so a refresh re-reads the appointment
 * rather than showing nothing. The booking page replaces its own history entry on the way here,
 * so the back button cannot walk into a booking that is already made.
 *
 * It reads the appointment and nothing else. The phone number is asked for on the confirm
 * step, before the booking, so this screen has nothing left to collect.
 */
@Component({
  selector: 'lib-booking-success',
  imports: [Banner, Button, LucideCalendarCheck, ReminderCard, RouterLink, TranslocoPipe],
  providers: [provideTranslocoScope(barbershopsTranslocoScope)],
  templateUrl: './booking-success.html',
  styleUrl: './booking-success.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BookingSuccess {
  private readonly api = inject(CustomerAppointmentsApi);
  private readonly route = inject(ActivatedRoute);
  private readonly language = inject(ActiveLanguage);

  private readonly appointmentId = computed(
    () => this.route.snapshot.paramMap.get('appointmentId') ?? '',
  );

  private readonly appointmentResource = rxResource({
    params: () => {
      const id = this.appointmentId();
      return id === '' ? undefined : { id };
    },
    stream: ({ params }) => this.api.get(params.id, this.language.value()),
  });

  protected readonly loading = computed(() => this.appointmentResource.isLoading());

  protected readonly appointment = computed(() => {
    const result = this.appointmentResource.value();
    return result?.isSuccess === true ? result.data : null;
  });

  protected readonly failed = computed(() => {
    const result = this.appointmentResource.value();
    return result !== undefined && !result.isSuccess;
  });

  protected readonly dateLabel = computed(() => {
    const booked = this.appointment();
    return booked === null ? '' : formatShopDate(booked.localDate, this.language.value(), true);
  });

  protected readonly totalLabel = computed(() => {
    const booked = this.appointment();
    if (booked === null) return '';
    return formatPrice(booked.totalPrice, booked.currency, this.language.value());
  });

  protected readonly cancellationHours = computed(() => {
    const minutes = this.appointment()?.cancellationCutoffMinutes ?? 0;
    return minutes <= 0 ? null : Math.round((minutes / 60) * 10) / 10;
  });

  protected readonly shopLink = computed(() => {
    const slug = this.appointment()?.companySlug ?? '';
    return withLanguagePrefix(`/barbershops/${slug}`, this.language.value());
  });

  protected duration(minutes: number): string {
    return formatDuration(minutes);
  }

  protected servicePrice(amount: number): string {
    const currency = this.appointment()?.currency ?? 'EUR';
    return formatPrice(amount, currency, this.language.value());
  }
}
