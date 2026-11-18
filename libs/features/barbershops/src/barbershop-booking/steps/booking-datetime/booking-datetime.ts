import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  computed,
  effect,
  inject,
  viewChild,
} from '@angular/core';
import { TranslocoPipe, translateSignal } from '@jsverse/transloco';
import { Banner } from '@ui/banner';
import { DatePicker } from '@ui/date-picker';
import { TimePicker } from '@ui/time-picker';
import { ActiveLanguage } from '@util/language';

import { BookingState } from '../../booking-state';
import { formatShopDate } from '../../core/format-booking';
import { addDays, timezoneCity, timezoneDiffers } from '../../core/shop-calendar';

/**
 * Step 4: the day, then the time on it.
 *
 * Both controls come from the shared library. The calendar takes the available days as
 * `validDates`, so every other day is disabled without this step deciding anything; the time
 * grid takes the available times as `validTimes`, which `createTimeSlots` renders verbatim, so
 * the flat grid *is* the availability.
 *
 * **Nothing here converts a local time to an instant.** Choosing a slot stores the `startsAtUtc`
 * the server sent with it, which is what keeps DST and the customer's own timezone out of the
 * booking.
 */
@Component({
  selector: 'lib-booking-datetime',
  imports: [Banner, DatePicker, TimePicker, TranslocoPipe],
  templateUrl: './booking-datetime.html',
  styleUrl: './booking-datetime.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BookingDatetime {
  /** Read by the template: the calendar names its months and weekdays in the page language. */
  protected readonly language = inject(ActiveLanguage);
  private readonly slotsRegion = viewChild<ElementRef<HTMLElement>>('slotsRegion');
  private readonly calendarRegion = viewChild<ElementRef<HTMLElement>>('calendarRegion');

  protected readonly state = inject(BookingState);

  protected readonly calendarLabel = translateSignal('booking.when.calendarLabel');
  protected readonly slotsLabel = translateSignal('booking.when.slotsLabel');

  protected readonly minDate = computed(() => this.state.today());

  protected readonly maxDate = computed(() => {
    const options = this.state.options();
    return options === null ? '' : addDays(this.state.today(), options.maxAdvanceDays);
  });

  protected readonly slotTimes = computed(() => this.state.slots().map((slot) => slot.time));

  /** Stated once when the shop keeps time somewhere other than where the customer is. */
  protected readonly foreignTimezone = computed(() => {
    const options = this.state.options();
    return options !== null && timezoneDiffers(options.timezone)
      ? timezoneCity(options.timezone)
      : null;
  });

  protected readonly chosenDateLabel = computed(() => {
    const date = this.state.date();
    return date === null ? '' : formatShopDate(date, this.language.value(), true);
  });

  /**
   * The first day the shop can take, offered when the chosen one turns out to have nothing.
   *
   * Normally unreachable, because the calendar disabled every unavailable day. It is reachable
   * from a day list that went stale between the render and the tap.
   */
  protected readonly nextAvailableDay = computed(() => {
    const date = this.state.date();
    if (date === null) return null;
    return this.state.availableDays().find((day) => day > date) ?? null;
  });

  protected readonly nextAvailableLabel = computed(() => {
    const day = this.nextAvailableDay();
    return day === null ? '' : formatShopDate(day, this.language.value(), true);
  });

  constructor() {
    // On a phone the slots render below the fold. Choosing a day and seeing nothing happen is
    // the failure this avoids; the calendar itself never moves.
    let lastDate: string | null = null;
    effect(() => {
      const date = this.state.date();
      if (date === null || date === lastDate) {
        lastDate = date;
        return;
      }
      lastDate = date;
      reveal(this.slotsRegion()?.nativeElement);
    });
  }

  protected onDateChange(date: string): void {
    if (date !== '') this.state.chooseDate(date);
  }

  protected onTimeChange(time: string): void {
    const slot = this.state.slots().find((candidate) => candidate.time === time);
    if (slot !== undefined) this.state.chooseTime(slot);
  }

  /** Takes the customer back to the calendar from the pinned day header. */
  protected backToCalendar(): void {
    reveal(this.calendarRegion()?.nativeElement);
  }
}

/**
 * Scrolls an element into view where the environment can.
 *
 * Wrapped because scrolling is a convenience and never the point: a runtime without layout —
 * jsdom, and a server render — has no `scrollIntoView`, and losing the whole effect to that
 * would take the date change with it.
 */
function reveal(element: HTMLElement | undefined): void {
  if (element === undefined) return;

  try {
    element.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  } catch {
    // No layout engine. The content is still correct, just not scrolled to.
  }
}
