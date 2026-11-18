import { Component, computed, inject, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import type { StaffMemberCardResponse } from '@api/staff';
import { Banner } from '@ui/banner';

import { StaffAvatar } from '../avatar/staff-avatar';
import { formatDay, formatWhen, formatWindows, jobTitleLabel, roleLabel } from '../staff.format';

/**
 * One member as a card. The whole card is one link to the member's drawer, so `Enter` opens it.
 * Every state reads as text as well as tone.
 */
@Component({
  selector: 'lib-staff-card',
  imports: [Banner, RouterLink, StaffAvatar, TranslocoPipe],
  templateUrl: './staff-card.html',
  styleUrl: './staff-card.scss',
})
export class StaffCard {
  private readonly transloco = inject(TranslocoService);

  readonly member = input.required<StaffMemberCardResponse>();
  readonly timezone = input.required<string>();
  readonly language = input.required<string>();
  /** The moment "today" and "tomorrow" are measured from. */
  readonly now = input.required<Date>();

  private readonly translate = (key: string, params?: Record<string, unknown>): string =>
    this.transloco.translate(key, params);

  /** Job title and roles under the name. */
  protected readonly subtitle = computed(() => {
    this.language();
    const member = this.member();
    const parts =
      member.jobTitleCode === null ? [] : [jobTitleLabel(member.jobTitleCode, this.translate)];
    return [
      ...parts,
      ...member.roleNames.map((name) => roleLabel(name, true, this.translate)),
    ].join(' · ');
  });

  /** Today at a glance: the hours, a day off, or the time off that runs now. */
  protected readonly today = computed(() => {
    this.language();
    const member = this.member();
    if (!member.isActive) return '';
    const timeOff = member.currentTimeOff;
    if (timeOff !== null) {
      return this.translate('managementStaff.card.onTimeOff', {
        date: formatDay(timeOff.endsOn, this.language(), this.now().getFullYear()),
      });
    }
    return member.today.windows.length === 0
      ? this.translate('managementStaff.card.dayOff')
      : this.translate('managementStaff.card.today', {
          hours: formatWindows(member.today.windows),
        });
  });

  protected readonly rating = computed(() => {
    const rating = this.member().rating;
    return rating === null
      ? null
      : new Intl.NumberFormat(this.language(), {
          minimumFractionDigits: 1,
          maximumFractionDigits: 1,
        }).format(rating);
  });

  protected readonly next = computed(() => {
    this.language();
    const next = this.member().nextAppointmentAt;
    return next === null
      ? null
      : formatWhen(next, this.timezone(), this.now(), this.language(), this.translate);
  });
}
