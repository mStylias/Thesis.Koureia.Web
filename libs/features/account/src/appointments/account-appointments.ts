import { Component, inject, signal } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import {
  CustomerAppointmentsApi,
  type AppointmentPeriod,
  type AppointmentResponse,
} from '@api/customer-appointments';
import type { ReviewResponse } from '@api/customer-reviews';
import { ActiveLanguage } from '@util/language';

import type { ReviewTarget } from '../account.types';
import { ACCOUNT_PAGE_SIZE, PagedListLoader } from '../paged-list';
import { ReviewDialog } from '../reviews/review-dialog/review-dialog';
import { appointmentReviewTarget, withReview } from '../reviews/review-target';
import { AppointmentList } from './appointment-list/appointment-list';

/**
 * The customer's appointments in two lists on one page: upcoming first, then the past ones. Each
 * list loads and pages on its own.
 */
@Component({
  selector: 'lib-account-appointments',
  imports: [AppointmentList, ReviewDialog, TranslocoPipe],
  templateUrl: './account-appointments.html',
  styleUrl: './account-appointments.scss',
})
export class AccountAppointments {
  private readonly api = inject(CustomerAppointmentsApi);
  private readonly language = inject(ActiveLanguage);

  protected readonly upcoming = this.loader('Upcoming');
  protected readonly past = this.loader('Past');

  protected readonly reviewOpen = signal(false);
  protected readonly reviewTarget = signal<ReviewTarget | null>(null);
  private readonly reviewing = signal<AppointmentResponse | null>(null);

  constructor() {
    void this.upcoming.reload();
    void this.past.reload();
  }

  protected rate(appointment: AppointmentResponse): void {
    this.reviewing.set(appointment);
    this.reviewTarget.set(appointmentReviewTarget(appointment));
    this.reviewOpen.set(true);
  }

  protected reviewed(review: ReviewResponse): void {
    const appointment = this.reviewing();
    if (appointment === null) return;
    this.past.replace((item) => item.id === appointment.id, withReview(appointment, review));
  }

  protected reviewStale(): void {
    void this.past.reload();
  }

  private loader(period: AppointmentPeriod): PagedListLoader<AppointmentResponse> {
    return new PagedListLoader((page) =>
      this.api.list({
        period,
        page,
        pageSize: ACCOUNT_PAGE_SIZE,
        languageCode: this.language.value(),
      }),
    );
  }
}
