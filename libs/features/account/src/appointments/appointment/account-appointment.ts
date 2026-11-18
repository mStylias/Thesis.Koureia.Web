import { Component, computed, inject, linkedSignal, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { LucideChevronLeft, LucideMail, LucidePhone } from '@lucide/angular';
import { CustomerAppointmentsApi, type AppointmentResponse } from '@api/customer-appointments';
import type { ReviewResponse } from '@api/customer-reviews';
import { ShopMap, ShopMapLinks, type MapShop } from '@features/barbershops';
import { Banner } from '@ui/banner';
import { Button, ButtonIcon } from '@ui/button';
import { Card } from '@ui/card';
import { Rating } from '@ui/rating';
import {
  formatPrice,
  formatRelativeDay,
  formatShopDate,
  formatShopInstant,
  formatShopTime,
} from '@util/booking-format';
import { ActiveLanguage, withLanguagePrefix } from '@util/language';
import { firstValueFrom, map } from 'rxjs';

import type { AppointmentPage, ReviewTarget } from '../../account.types';
import { ReviewDialog } from '../../reviews/review-dialog/review-dialog';
import { appointmentReviewTarget, withReview } from '../../reviews/review-target';
import { appointmentActions, statusChip, telHref } from '../appointment-state';
import { CancelAppointmentDialog } from '../cancel-dialog/cancel-appointment-dialog';
import { APPOINTMENT_PAGE, toAppointmentPage } from './account-appointment.resolvers';

/**
 * One of the customer's appointments, and what they can do about it. The actions come from the
 * server's `canChange` and `canReview`; the page never works out the cutoff or the window.
 */
@Component({
  selector: 'lib-account-appointment',
  imports: [
    Banner,
    Button,
    ButtonIcon,
    CancelAppointmentDialog,
    Card,
    LucideChevronLeft,
    LucideMail,
    LucidePhone,
    Rating,
    ReviewDialog,
    RouterLink,
    ShopMap,
    ShopMapLinks,
    TranslocoPipe,
  ],
  templateUrl: './account-appointment.html',
  styleUrl: './account-appointment.scss',
})
export class AccountAppointment {
  private readonly api = inject(CustomerAppointmentsApi);
  private readonly route = inject(ActivatedRoute);
  private readonly language = inject(ActiveLanguage);

  private readonly resolved = toSignal(
    this.route.data.pipe(map((data) => data[APPOINTMENT_PAGE] as AppointmentPage)),
    { requireSync: true },
  );

  /** The resolved page, then whatever a cancel, a review or a reload put in its place. */
  protected readonly page = linkedSignal(() => this.resolved());
  protected readonly reloading = signal(false);

  protected readonly appointment = computed(() => {
    const page = this.page();
    return page.status === 'found' ? page.appointment : null;
  });

  protected readonly actions = computed(() => {
    const appointment = this.appointment();
    return appointment === null ? null : appointmentActions(appointment);
  });

  protected readonly status = computed(() => {
    const appointment = this.appointment();
    return appointment === null ? null : statusChip(appointment.status);
  });

  /** `Οκτ`, for the calendar badge. */
  protected readonly month = computed(() => {
    const date = this.appointment()?.localDate ?? '';
    const parsed = new Date(`${date}T00:00:00Z`);
    if (Number.isNaN(parsed.getTime())) return '';
    return new Intl.DateTimeFormat(this.language.value(), {
      month: 'short',
      timeZone: 'UTC',
    }).format(parsed);
  });

  protected readonly dayOfMonth = computed(() =>
    Number((this.appointment()?.localDate ?? '').slice(8, 10)),
  );

  protected readonly longDate = computed(() => {
    const appointment = this.appointment();
    return appointment === null
      ? ''
      : formatShopDate(appointment.localDate, this.language.value(), true);
  });

  protected readonly relativeDay = computed(() => {
    const appointment = this.appointment();
    return appointment === null
      ? ''
      : formatRelativeDay(appointment.localDate, appointment.timezone, this.language.value());
  });

  protected readonly endTime = computed(() => {
    const appointment = this.appointment();
    return appointment === null
      ? ''
      : formatShopTime(appointment.endsAtUtc, appointment.timezone, this.language.value());
  });

  protected readonly total = computed(() => {
    const appointment = this.appointment();
    return appointment === null
      ? ''
      : formatPrice(appointment.totalPrice, appointment.currency, this.language.value());
  });

  protected readonly changeableUntil = computed(() =>
    this.instant(this.appointment()?.changeableUntilUtc),
  );
  protected readonly reviewableUntil = computed(() =>
    this.instant(this.appointment()?.reviewableUntilUtc),
  );
  protected readonly cancelledAt = computed(() => this.instant(this.appointment()?.cancelledAtUtc));

  protected readonly cancelledKey = computed(() => {
    switch (this.appointment()?.cancelledBy) {
      case 'Customer':
        return 'account.appointment.cancelledByCustomer';
      case 'Shop':
        return 'account.appointment.cancelledByShop';
      default:
        return 'account.appointment.cancelledAt';
    }
  });

  protected readonly phoneHref = computed(() => {
    const phone = this.appointment()?.companyPhone ?? '';
    return phone === '' ? null : telHref(phone);
  });

  protected readonly mapShop = computed<MapShop>(() => {
    const appointment = this.appointment();
    return {
      id: appointment?.companyId ?? '',
      name: appointment?.companyName ?? '',
      latitude: appointment?.companyLatitude ?? 0,
      longitude: appointment?.companyLongitude ?? 0,
    };
  });

  /** The address's second line: `Κολωνάκι, Αθήνα`. */
  protected readonly locality = computed(() => {
    const appointment = this.appointment();
    return [appointment?.companyNeighborhood, appointment?.companyCity]
      .filter((part) => part !== null && part !== undefined && part.trim() !== '')
      .join(', ');
  });

  protected readonly backLink = computed(() =>
    withLanguagePrefix('/account/appointments', this.language.value()),
  );

  protected readonly cancelOpen = signal(false);
  protected readonly reviewOpen = signal(false);
  protected readonly reviewTarget = computed<ReviewTarget | null>(() => {
    const appointment = this.appointment();
    return appointment === null ? null : appointmentReviewTarget(appointment);
  });

  protected price(amount: number): string {
    return formatPrice(amount, this.appointment()?.currency ?? 'EUR', this.language.value());
  }

  /** The query that seeds "Book again" with the same services and barber. */
  protected bookAgainQuery(): Record<string, string> {
    const appointment = this.appointment();
    if (appointment === null) return {};
    return {
      services: appointment.services.map((service) => service.serviceId).join(','),
      barber: appointment.staffMemberId,
    };
  }

  protected bookingPath(slug: string): string {
    return withLanguagePrefix(
      `/barbershops/${encodeURIComponent(slug)}/booking`,
      this.language.value(),
    );
  }

  protected cancelled(appointment: AppointmentResponse): void {
    this.page.set({ status: 'found', appointment });
  }

  protected reviewed(review: ReviewResponse): void {
    const appointment = this.appointment();
    if (appointment !== null) {
      this.page.set({ status: 'found', appointment: withReview(appointment, review) });
    }
  }

  /** Reads the appointment again, after a refusal that says the page is out of date. */
  protected async reload(): Promise<void> {
    const id = this.route.snapshot.paramMap.get('id') ?? '';
    this.reloading.set(true);
    const result = await firstValueFrom(this.api.get(id, this.language.value()));
    this.page.set(toAppointmentPage(result));
    this.reloading.set(false);
  }

  private instant(utc: string | null | undefined): string | null {
    const appointment = this.appointment();
    if (utc === null || utc === undefined || appointment === null) return null;
    return formatShopInstant(utc, appointment.timezone, this.language.value());
  }
}
