import {
  Component,
  DestroyRef,
  ElementRef,
  Injector,
  afterNextRender,
  computed,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { Tooltip } from '@ui/tooltip';
import { UiCopyPipe } from '@util/ui-copy';
import {
  addDays,
  createDateLocaleInfo,
  formatMonthHeading,
  type DateValue,
  type IsoWeekday,
} from '@ui/date-picker';
import { CALENDAR_TRANSLOCO_SCOPE } from '../calendar.i18n';
import type { CalendarHours } from '../calendar.types';
import {
  isoWeekdayOf,
  monthGridDays,
  monthOf,
  yearMonths,
  yearOf,
  zoneClock,
} from '../core/date-math';
import { dayLabel, yearLabel } from '../core/range-label';
import { densityStep } from '../core/tile-layout';
import type { YearDay, YearMonth } from './calendar-year.types';

const CLOCK_INTERVAL_MS = 60_000;

/** The legend's four steps, as the counts each stands for. */
const LEGEND = ['0', '1–2', '3–5', '6+'] as const;

/**
 * The year as twelve mini months, each day tinted by how much it holds.
 *
 * ```html
 * <lib-calendar-year [anchor]="anchor()" [dayCounts]="counts()" [hours]="hours()" (dayOpen)="showDay($event)" />
 * ```
 *
 * Four tint steps rather than a ramp, and a legend that names them. A day's
 * count is also in its `title` and its accessible name, so the tint is never
 * the only carrier. Closed weekdays are not tinted. Each month is its own grid
 * with one tab stop; the arrow keys walk its days and `Enter` opens one.
 */
@Component({
  selector: 'lib-calendar-year',
  templateUrl: './calendar-year.html',
  styleUrl: './calendar-year.scss',
  imports: [Tooltip, TranslocoPipe, UiCopyPipe],
  providers: [CALENDAR_TRANSLOCO_SCOPE],
  host: { class: 'yc-host', '(click)': 'onClick($event)' },
})
export class CalendarYear {
  private readonly destroyRef = inject(DestroyRef);
  private readonly injector = inject(Injector);
  private readonly elementRef = inject<ElementRef<HTMLElement>>(ElementRef);

  /** Any date of the year to draw. */
  readonly anchor = input.required<DateValue>();

  /** Events per day, keyed by `YYYY-MM-DD`. A missing day counts as zero. */
  readonly dayCounts = input<Readonly<Record<DateValue, number>>>({});

  /** Open hours per weekday. A weekday with none is drawn closed and never tinted. */
  readonly hours = input<readonly CalendarHours[]>([]);

  /** The zone "today" is read in. Defaults to the browser's. */
  readonly timezone = input(Intl.DateTimeFormat().resolvedOptions().timeZone);

  readonly locale = input('el');

  readonly firstDayOfWeek = input<IsoWeekday>(1);

  /** A day was clicked, or `Enter` pressed on it. The host shows that day. */
  readonly dayOpen = output<DateValue>();

  /** A month card was clicked outside its days. Emits the month's first day. The host shows that month. */
  readonly monthOpen = output<DateValue>();

  private readonly tick = signal(new Date());
  private readonly today = computed(() => zoneClock(this.timezone(), this.tick()).date);

  protected readonly heading = computed(() => yearLabel(this.anchor(), this.locale()));

  protected readonly legend = LEGEND;

  /** One letter per weekday, in the week's order. */
  protected readonly weekdays = computed(() =>
    createDateLocaleInfo(this.locale(), this.firstDayOfWeek()).weekdays.map((weekday) => ({
      initial: weekday.short.slice(0, 1),
      label: weekday.label,
    })),
  );

  protected readonly months = computed<readonly YearMonth[]>(() => {
    const locale = this.locale();
    const today = this.today();
    const counts = this.dayCounts();
    const open = new Set(this.hours().map((entry) => entry.weekday));
    return yearMonths(yearOf(this.anchor())).map((month) => {
      const days = monthGridDays(month, this.firstDayOfWeek());
      const weeks: YearDay[][] = [];
      for (let index = 0; index < days.length; index += 7) {
        weeks.push(
          days.slice(index, index + 7).map((date) => {
            const count = counts[date] ?? 0;
            return {
              date,
              day: Number(date.slice(8)),
              outside: monthOf(date) !== month,
              today: date === today,
              closed: !open.has(isoWeekdayOf(date)),
              count,
              step: densityStep(count),
              label: dayLabel(date, locale),
            };
          }),
        );
      }
      return { month, heading: formatMonthHeading(month, locale), weeks };
    });
  });

  /** The day holding each month's tab stop, when the keyboard has moved it. */
  private readonly focusedDate = signal<DateValue | null>(null);

  constructor() {
    afterNextRender(() => {
      const handle = setInterval(() => {
        this.tick.set(new Date());
      }, CLOCK_INTERVAL_MS);
      this.destroyRef.onDestroy(() => {
        clearInterval(handle);
      });
    });
  }

  /** The tab stop of a month: the focused day if it is there, else today, else the 1st. */
  protected rovingDate(month: YearMonth): DateValue {
    const focused = this.focusedDate();
    if (focused !== null && monthOf(focused) === month.month) {
      return focused;
    }
    const today = this.today();
    return monthOf(today) === month.month ? today : `${month.month}-01`;
  }

  protected onDayFocus(day: YearDay): void {
    this.focusedDate.set(day.date);
  }

  protected openMonth(month: YearMonth): void {
    this.monthOpen.emit(`${month.month}-01`);
  }

  /**
   * A pointer press on a month card, outside its days, opens the month. Listened on the host:
   * the card is not a control, and its heading button is the keyboard's way in.
   */
  protected onClick(event: MouseEvent): void {
    const target = event.target as HTMLElement | null;
    if (target?.closest('[data-date], .yc-heading-button') != null) return;
    const month = target?.closest<HTMLElement>('[data-month]')?.dataset['month'];
    if (month !== undefined) this.monthOpen.emit(`${month}-01`);
  }

  protected onDayClick(day: YearDay): void {
    this.dayOpen.emit(day.date);
  }

  /** Arrows move within the month, `Enter` opens the day. */
  protected onDayKeydown(month: YearMonth, day: YearDay, event: KeyboardEvent): void {
    const step: Readonly<Record<string, number | undefined>> = {
      ArrowRight: 1,
      ArrowLeft: -1,
      ArrowDown: 7,
      ArrowUp: -7,
    };
    const days = step[event.key];
    if (days !== undefined) {
      event.preventDefault();
      const target = addDays(day.date, days);
      if (monthOf(target) === month.month) {
        this.focusedDate.set(target);
        afterNextRender(
          () => {
            this.elementRef.nativeElement
              .querySelector<HTMLElement>(`[data-date="${target}"]`)
              ?.focus();
          },
          { injector: this.injector },
        );
      }
      return;
    }
    if (event.key === 'Enter') {
      event.preventDefault();
      this.dayOpen.emit(day.date);
    }
  }
}
