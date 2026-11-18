import { Component, computed, inject, input } from '@angular/core';
import { FormField, type FieldTree } from '@angular/forms/signals';
import { provideTranslocoScope, TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { LucideCopy, LucidePlus, LucideX } from '@lucide/angular';
import type { BusinessHourViewDto } from '@api/appointments';
import { Button, ButtonIcon } from '@ui/button';
import { Switch } from '@ui/switch';
import { TimePicker } from '@ui/time-picker';
import { Tooltip } from '@ui/tooltip';

import {
  earlierOpenRanges,
  FALLBACK_RANGE,
  nextRange,
  outsideShop,
  shopWindows,
  startingRanges,
} from '../form/hours-draft';
import { HOURS_MINUTE_STEP } from '../form/hours.form';
import type {
  HoursDayFormValue,
  HoursFormValue,
  HoursRangeFormValue,
} from '../form/hours.form.types';
import { staffScheduleTranslocoScope } from '../staff-schedule.i18n';

const K = 'managementStaffSchedule.hours';

/**
 * The week in edit mode: per day a switch, one or more ranges of two time pickers, remove range,
 * add range, and copy to the other days. The host owns the form, the save and the view mode.
 *
 * ```html
 * <lib-week-hours-grid
 *   idPrefix="company-hours"
 *   [form]="editor.form"
 *   [language]="language()"
 *   [maxRanges]="4"
 *   [offText]="'managementCompany.hours.closed' | transloco"
 * />
 * ```
 *
 * With a `reference` week, each day shows the reference's hours, a range outside them gets a
 * warning, a day switched on starts from the reference's hours that day, and Copy goes to every
 * day the reference opens. Without one, a day switched on starts from the nearest earlier open
 * day, and Copy goes to every open day.
 */
@Component({
  selector: 'lib-week-hours-grid',
  imports: [
    Button,
    ButtonIcon,
    FormField,
    LucideCopy,
    LucidePlus,
    LucideX,
    Switch,
    TimePicker,
    Tooltip,
    TranslocoPipe,
  ],
  providers: [provideTranslocoScope(staffScheduleTranslocoScope)],
  templateUrl: './week-hours-grid.html',
  styleUrl: './week-hours-grid.scss',
})
export class WeekHoursGrid {
  private readonly transloco = inject(TranslocoService);

  /** The host's form. Its value is always seven days, Monday first. */
  readonly form = input.required<FieldTree<HoursFormValue>>();
  readonly language = input.required<string>();
  /** The start of each switch's id: `<idPrefix>-day-<index>`. */
  readonly idPrefix = input('week-hours');
  /** The week the ranges must sit inside, such as the shop's hours for a member. */
  readonly reference = input<readonly BusinessHourViewDto[] | null>(null);
  /** The time pickers' step, in minutes. */
  readonly step = input(HOURS_MINUTE_STEP);
  /** The most ranges a day can have. Add range goes away at the limit. */
  readonly maxRanges = input<number | null>(null);
  /** The range a day starts with when nothing else gives one. */
  readonly fallbackRange = input<HoursRangeFormValue>(FALLBACK_RANGE);
  /** The text of a day that is switched off, already translated. Empty shows "Day off". */
  readonly offText = input('');
  /** The label of Copy, already translated. Empty shows the lib's own label. */
  readonly copyToAllText = input('');

  /** Each day as the template draws it: its name, the reference, and which ranges sit outside. */
  protected readonly days = computed(() => {
    this.language();
    const reference = this.reference();
    const max = this.maxRanges();
    return this.form()()
      .value()
      .days.map((day, index) => {
        const shop = reference === null ? null : shopWindows(reference, day.dayOfWeek);
        return {
          index,
          id: `${this.idPrefix()}-day-${index}`,
          name: this.transloco.translate(`managementStaffSchedule.days.${day.dayOfWeek}`),
          referenceText: shop === null ? null : this.referenceText(shop),
          working: day.working,
          canAdd: max === null || day.ranges.length < max,
          ranges: day.ranges.map((range) => ({
            outside: shop !== null && day.working && outsideShop(range, shop),
          })),
        };
      });
  });

  protected setWorking(dayIndex: number, working: boolean): void {
    const days = this.form()().value().days;
    if (days.at(dayIndex) === undefined) return;
    const from = this.startFrom(days, dayIndex);
    this.updateDay(dayIndex, (current) => ({
      ...current,
      working,
      ranges:
        working && current.ranges.length === 0
          ? startingRanges(from, this.fallbackRange())
          : current.ranges,
    }));
  }

  protected addRange(dayIndex: number): void {
    this.updateDay(dayIndex, (day) => ({ ...day, ranges: [...day.ranges, nextRange(day)] }));
  }

  /** The last range gone switches the day off. */
  protected removeRange(dayIndex: number, rangeIndex: number): void {
    this.updateDay(dayIndex, (day) => {
      const ranges = day.ranges.filter((_, index) => index !== rangeIndex);
      return { ...day, ranges, working: ranges.length > 0 };
    });
  }

  /** One day's ranges on every day the reference opens, or on every open day without one. */
  protected copyToAll(dayIndex: number): void {
    const state = this.form()();
    const source = state.value().days.at(dayIndex);
    if (source === undefined) return;
    const reference = this.reference();
    state.value.update((value) => ({
      days: value.days.map((day, index) => {
        if (index === dayIndex) return day;
        const target =
          reference === null ? day.working : shopWindows(reference, day.dayOfWeek).length > 0;
        return target
          ? { ...day, working: true, ranges: source.ranges.map((range) => ({ ...range })) }
          : day;
      }),
    }));
  }

  private startFrom(
    days: readonly HoursDayFormValue[],
    dayIndex: number,
  ): readonly HoursRangeFormValue[] {
    const reference = this.reference();
    const dayOfWeek = days.at(dayIndex)?.dayOfWeek ?? 1;
    return reference === null
      ? earlierOpenRanges(days, dayIndex)
      : shopWindows(reference, dayOfWeek);
  }

  private referenceText(shop: readonly HoursRangeFormValue[]): string {
    return shop.length === 0
      ? this.transloco.translate(`${K}.shopClosed`)
      : this.transloco.translate(`${K}.shop`, {
          hours: shop.map((range) => `${range.startTime}–${range.endTime}`).join(', '),
        });
  }

  private updateDay(dayIndex: number, change: (day: HoursDayFormValue) => HoursDayFormValue): void {
    this.form()().value.update((value) => ({
      days: value.days.map((day, index) => (index === dayIndex ? change(day) : day)),
    }));
  }
}
