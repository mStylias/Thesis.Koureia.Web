import { Component, computed, inject, input, linkedSignal, output } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { NgTemplateOutlet } from '@angular/common';
import { RouterLink, type UrlTree } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { LucideChevronRight } from '@lucide/angular';
import { AppointmentsApi, type AppointmentODataResponse } from '@api/appointments';
import { zoneClock } from '@ui/calendar';

import {
  APPOINTMENT_STATUS_SPECS,
  isAppointmentStatus,
  statusLabelKey,
} from '../appointment-status';
import { formatShortDate } from './appointment-format';
import type { HistoryGroup, HistoryRow, OpenAppointment } from './customer-history.types';

/** How many other appointments the list shows. */
export const HISTORY_SIZE = 5;

export const HISTORY_FIELDS = [
  'id',
  'localDate',
  'localStartTime',
  'staffDisplayName',
  'status',
  'services',
] as const satisfies readonly (keyof AppointmentODataResponse)[];

/**
 * The customer's other appointments at the shop, split at now: the upcoming soonest first, the
 * past newest first. One more than shown is read, so the open appointment can be left out and the
 * list still holds {@link HISTORY_SIZE}.
 */
@Component({
  selector: 'lib-customer-history',
  imports: [LucideChevronRight, NgTemplateOutlet, RouterLink, TranslocoPipe],
  templateUrl: './customer-history.html',
  styleUrl: './customer-history.scss',
})
export class CustomerHistory {
  private readonly api = inject(AppointmentsApi);

  readonly customerId = input.required<string>();
  /** The appointment the drawer shows, which is not history. `null` lists every appointment. */
  readonly excludeId = input<string | null>(null);
  readonly language = input.required<string>();
  /** The shop's time zone, which says what has passed. */
  readonly timezone = input.required<string>();
  /** The heading's translation key. The appointment drawer's says "Other appointments". */
  readonly titleKey = input('managementAppointments.view.history');
  /** A change reads the list again, for a write that keeps the customer, such as a merge. */
  readonly revision = input(0);
  /** Where "View all" goes. `null` hides it. */
  readonly viewAll = input<UrlTree | null>(null);

  /** Draws each row as a link to this address, so it can open in a new tab. `null` emits instead. */
  readonly appointmentLink = input<((appointment: OpenAppointment) => UrlTree) | null>(null);

  /** A row was chosen. Not emitted for a row drawn as a link. */
  readonly openAppointment = output<OpenAppointment>();

  private readonly history = rxResource({
    params: () => ({
      customerId: this.customerId(),
      language: this.language(),
      revision: this.revision(),
    }),
    stream: ({ params }) =>
      this.api.customerAppointments(
        params.customerId,
        params.language,
        HISTORY_SIZE + 1,
        HISTORY_FIELDS,
      ),
  });

  protected readonly failed = computed(() => {
    if (this.history.isLoading()) return false;
    const result = this.history.hasValue() ? this.history.value() : null;
    return this.history.error() !== undefined || result?.isFailure === true;
  });

  /**
   * The last list read for this customer. A reload keeps it, so opening another of the same
   * customer's appointments does not empty the list and pull the footer up under the reader.
   */
  private readonly held = linkedSignal<
    { readonly customerId: string; readonly rows: readonly HistoryRow[] | null },
    readonly HistoryRow[]
  >({
    source: () => {
      const result = this.history.hasValue() ? this.history.value() : null;
      return {
        customerId: this.customerId(),
        rows: result?.isSuccess === true ? (result.data ?? []) : null,
      };
    },
    computation: (next, previous) =>
      next.rows ?? (previous?.source.customerId === next.customerId ? previous.value : []),
  });

  protected readonly rows = computed<readonly HistoryRow[]>(() =>
    this.held()
      .filter((row) => row.id !== this.excludeId())
      .slice(0, HISTORY_SIZE),
  );

  /** Now is read when the rows change, not on a clock, so an open list stays put. */
  protected readonly groups = computed<readonly HistoryGroup[]>(() => {
    const clock = zoneClock(this.timezone());
    const now = `${clock.date} ${clock.time}`;
    const upcoming: HistoryRow[] = [];
    const past: HistoryRow[] = [];
    for (const row of this.rows()) {
      (`${row.localDate} ${row.localStartTime}` > now ? upcoming : past).push(row);
    }
    const groups: HistoryGroup[] = [
      { key: 'upcoming', rows: upcoming.reverse() },
      { key: 'past', rows: past },
    ];
    return groups.filter((group) => group.rows.length > 0);
  });

  protected date(row: HistoryRow): string {
    return formatShortDate(row.localDate, this.language());
  }

  protected statusKey(row: HistoryRow): string {
    return isAppointmentStatus(row.status) ? statusLabelKey(row.status) : row.status;
  }

  protected tone(row: HistoryRow): string {
    return isAppointmentStatus(row.status) ? APPOINTMENT_STATUS_SPECS[row.status].tone : 'neutral';
  }

  protected services(row: HistoryRow): string {
    return row.services.map((service) => service.name).join(', ');
  }
}
