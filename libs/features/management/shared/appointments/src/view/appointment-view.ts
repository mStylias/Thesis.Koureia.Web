import { Component, computed, input, output } from '@angular/core';
import type { UrlTree } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { LucidePhone } from '@lucide/angular';
import type { AppointmentDetailsResponse } from '@api/appointments';
import { Banner } from '@ui/banner';
import { Button, ButtonIcon } from '@ui/button';
import { CopyButton } from '@ui/copy-button';
import { Tooltip } from '@ui/tooltip';

import {
  APPOINTMENT_STATUS_SPECS,
  isAppointmentStatus,
  statusLabelKey,
} from '../appointment-status';
import type { PanelStaffMember } from '../host/appointment-panel-host.types';
import { toMinutes } from '../form/appointment-draft';

import { CustomerHistory } from './customer-history';
import type { OpenAppointment } from './customer-history.types';
import { formatInstant, formatMoney, formatShortDate } from './appointment-format';

/**
 * One appointment, read: when, who, what and how much, its notes, and who booked and changed it.
 * The panel's toolbar holds the actions, so nothing here edits anything.
 */
@Component({
  selector: 'lib-appointment-view',
  imports: [
    Banner,
    Button,
    ButtonIcon,
    CopyButton,
    CustomerHistory,
    LucidePhone,
    Tooltip,
    TranslocoPipe,
  ],
  templateUrl: './appointment-view.html',
  styleUrl: './appointment-view.scss',
})
export class AppointmentView {
  readonly appointment = input.required<AppointmentDetailsResponse>();
  /** The barber as the page knows them, for the swatch and the inactive mark. */
  readonly staffMember = input<PanelStaffMember | null>(null);
  /** The shop's time zone, which the instants are written in. */
  readonly timezone = input.required<string>();
  readonly language = input.required<string>();
  /** Where "View all" of the history goes. `null` hides it. */
  readonly customerLink = input<UrlTree | null>(null);

  /** A history entry was chosen. */
  readonly openAppointment = output<OpenAppointment>();

  protected readonly statusKey = computed(() => {
    const status = this.appointment().status;
    return isAppointmentStatus(status) ? statusLabelKey(status) : status;
  });

  protected readonly tone = computed(() => {
    const status = this.appointment().status;
    return isAppointmentStatus(status) ? APPOINTMENT_STATUS_SPECS[status].tone : 'neutral';
  });

  protected readonly date = computed(() =>
    formatShortDate(this.appointment().localDate, this.language()),
  );

  protected readonly minutes = computed(() =>
    this.appointment().services.reduce((sum, service) => sum + service.durationMinutes, 0),
  );

  /** The booked length, which an override changes, so it is read from the times. */
  protected readonly length = computed(() => {
    const { localStartTime, localEndTime } = this.appointment();
    return (toMinutes(localEndTime) ?? 0) - (toMinutes(localStartTime) ?? 0);
  });

  /** From the second no-show the count reads as a warning. */
  protected readonly noShowWarning = computed(() => this.appointment().customerNoShowCount >= 2);

  /** The customer's preferred barber, when it is not this appointment's. */
  protected readonly preferredBarber = computed(() => {
    const appointment = this.appointment();
    const name = appointment.customerPreferredStaffDisplayName;
    if (name === null || appointment.customerPreferredStaffMemberId === appointment.staffMemberId) {
      return null;
    }
    return { name, isActive: appointment.customerPreferredStaffIsActive !== false };
  });

  protected readonly swatch = computed(() => this.staffMember()?.swatch ?? null);
  protected readonly inactive = computed(() => this.staffMember()?.isActive === false);

  /** `tel:` wants the number without spaces. */
  protected readonly phoneHref = computed(() => {
    const phone = this.appointment().customerPhoneNumber;
    return phone === null ? null : `tel:${phone.replace(/\s+/g, '')}`;
  });

  protected money(amount: number): string {
    return formatMoney(amount, this.appointment().currency, this.language());
  }

  protected instant(value: string): string {
    return formatInstant(value, this.language(), this.timezone());
  }
}
