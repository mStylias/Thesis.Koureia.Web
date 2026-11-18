import { Component, computed, ElementRef, inject, input, output, viewChild } from '@angular/core';
import { RouterLink } from '@angular/router';
import { provideTranslocoScope, TranslocoPipe } from '@jsverse/transloco';
import { StaffAccessStore } from '@auth/data-access';
import { Banner } from '@ui/banner';
import { Button } from '@ui/button';

import { formatDay } from '../staff-schedule.format';
import { staffScheduleTranslocoScope } from '../staff-schedule.i18n';
import type { ScheduleConflict, StaffConflictsKind } from './staff-conflicts.types';

/**
 * The appointments page's address. The layout lib imports this one through the pages, so its path
 * constant cannot be imported back.
 */
const APPOINTMENTS_PATH = '/management/appointments';

/**
 * The upcoming appointments an hours, time-off or closure save left uncovered. Nothing was moved:
 * the owner decides, so each one links to its drawer. A shop-wide save passes its own `heading`,
 * and its lines name the barber.
 */
@Component({
  selector: 'lib-staff-conflicts',
  imports: [Banner, Button, RouterLink, TranslocoPipe],
  providers: [provideTranslocoScope(staffScheduleTranslocoScope)],
  template: `
    <!-- Focusable from code only, so a save can move the reader to it. -->
    <lib-banner
      tone="warning"
      role="status"
      tabindex="-1"
      [heading]="heading() || ('managementStaffSchedule.conflicts.' + kind() | transloco)"
    >
      <p class="conflicts-text">{{ 'managementStaffSchedule.conflicts.text' | transloco }}</p>
      <ul class="conflicts-list">
        @for (item of items(); track item.appointmentId) {
          <li>
            @if (canOpen()) {
              <a
                [routerLink]="[appointmentsPath, item.appointmentId]"
                [attr.aria-label]="
                  'managementStaffSchedule.conflicts.open'
                    | transloco
                      : {
                          customer: item.customerDisplayName,
                          date: item.date,
                          start: item.localStartTime,
                        }
                "
                >{{ item.text }}</a
              >
            } @else {
              {{ item.text }}
            }
          </li>
        }
      </ul>
      <button
        libButton
        libBannerAction
        type="button"
        variant="text"
        size="sm"
        (click)="dismissed.emit()"
      >
        {{ 'managementStaffSchedule.conflicts.dismiss' | transloco }}
      </button>
    </lib-banner>
  `,
  styleUrl: './staff-conflicts.scss',
})
export class StaffConflicts {
  private readonly access = inject(StaffAccessStore);

  readonly conflicts = input.required<readonly ScheduleConflict[]>();
  readonly kind = input<StaffConflictsKind>('hours');
  /** Replaces the title that `kind` names. Already translated. */
  readonly heading = input('');
  readonly language = input.required<string>();

  readonly dismissed = output();

  private readonly banner = viewChild.required<Banner, ElementRef<HTMLElement>>(Banner, {
    read: ElementRef,
  });

  protected readonly appointmentsPath = APPOINTMENTS_PATH;

  protected readonly canOpen = computed(() => this.access.has('appointments:read_all'));

  protected readonly items = computed(() => {
    const year = new Date().getFullYear();
    return this.conflicts().map((conflict) => {
      const date = formatDay(conflict.localDate, this.language(), year);
      return {
        ...conflict,
        date,
        text: [
          `${date}, ${conflict.localStartTime}–${conflict.localEndTime}`,
          conflict.staffMemberDisplayName,
          conflict.customerDisplayName,
        ]
          .filter((part) => part !== undefined)
          .join(' · '),
      };
    });
  });

  /** Scrolls the list into view and moves focus to it, so the reader cannot miss it. */
  reveal(): void {
    const banner = this.banner().nativeElement;
    banner.scrollIntoView({ block: 'nearest' });
    banner.focus({ preventScroll: true });
  }
}
