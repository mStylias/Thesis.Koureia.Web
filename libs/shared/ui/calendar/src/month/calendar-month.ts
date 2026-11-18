import {
  Component,
  DestroyRef,
  ElementRef,
  Injector,
  afterNextRender,
  computed,
  inject,
  input,
  model,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { UiCopyPipe } from '@util/ui-copy';
import { addDays, createDateLocaleInfo, type DateValue, type IsoWeekday } from '@ui/date-picker';
import { PopoverTrigger } from '@ui/popover';
import { CALENDAR_TRANSLOCO_SCOPE } from '../calendar.i18n';
import type {
  CalendarEvent,
  CalendarHours,
  CalendarResource,
  CalendarSlot,
} from '../calendar.types';
import { isoWeekdayOf, minutesOf, monthGridDays, monthOf, zoneClock } from '../core/date-math';
import { eventNameSuffix } from '../core/event-label';
import { CalendarMarks } from '../marks/calendar-marks';
import { dayLabel, monthLabel, timeLabel } from '../core/range-label';
import { fitList } from '../core/tile-layout';
import { CalendarMorePopover } from '../more-popover/calendar-more-popover';
import type {
  MonthCell,
  MonthCellEvent,
  MonthCellView,
  MonthRow,
  MonthRowView,
} from './calendar-month.types';

/** Rows a cell shows before it has been measured, or where there is no layout. */
const DEFAULT_CAPACITY = 3;

/** Dots a compact cell draws before the count alone has to say the rest. */
const MAX_DOTS = 6;

const CLOCK_INTERVAL_MS = 60_000;

let nextId = 0;

/**
 * The month as a grid of whole weeks.
 *
 * ```html
 * <lib-calendar-month
 *   [anchor]="anchor()"
 *   [events]="events()"
 *   [resources]="resources()"
 *   [hours]="hours()"
 *   [(selectedEventId)]="openId"
 *   (eventOpen)="open($event)"
 *   (dayOpen)="showDay($event)"
 *   (slotCreate)="create($event)"
 * />
 * ```
 *
 * Each cell lists its day's events in start order and trims the list to the
 * rows that fit, giving the last row to a "+N" chip. How many rows fit is
 * measured once per resize, never per event. Below the cell width floor the
 * rows become swatch dots and the count moves into the cell's name. The day
 * number opens the day; a double click on empty space asks to create there.
 */
@Component({
  selector: 'lib-calendar-month',
  templateUrl: './calendar-month.html',
  styleUrl: './calendar-month.scss',
  imports: [TranslocoPipe, UiCopyPipe, CalendarMarks, CalendarMorePopover, PopoverTrigger],
  providers: [CALENDAR_TRANSLOCO_SCOPE],
  host: {
    class: 'mc-host',
    '[style.--mc-rows]': 'rows().length',
  },
})
export class CalendarMonth {
  private readonly destroyRef = inject(DestroyRef);
  private readonly injector = inject(Injector);

  /** Any date of the month to draw. */
  readonly anchor = input.required<DateValue>();

  /** The events of the visible weeks, already filtered by the host. */
  readonly events = input<readonly CalendarEvent[]>([]);

  /** The resources, for the swatches. */
  readonly resources = input<readonly CalendarResource[]>([]);

  /** Open hours per weekday. A weekday with none is drawn closed. */
  readonly hours = input<readonly CalendarHours[]>([]);

  /** The zone "today" is read in. Defaults to the browser's. */
  readonly timezone = input(Intl.DateTimeFormat().resolvedOptions().timeZone);

  readonly locale = input('el');

  /** The host's noun for a resource, spoken before its name. Empty names the resource alone. */
  readonly resourceLabel = input('');

  readonly firstDayOfWeek = input<IsoWeekday>(1);

  /** Whether each row shows its start time. The accessible names carry it either way. */
  readonly showTime = input(false);

  /** The event that is open. Two-way, so a click writes it back. */
  readonly selectedEventId = model<string | null>(null);

  /** An event row was clicked, here or in a "+N" list. */
  readonly eventOpen = output<CalendarEvent>();

  /** A day number was clicked, or `Enter` pressed on a cell. The host shows that day. */
  readonly dayOpen = output<DateValue>();

  /** Empty space in a cell was double-clicked, or `Shift`+`Enter` pressed on it. */
  readonly slotCreate = output<CalendarSlot>();

  private readonly gridRef = viewChild.required<ElementRef<HTMLElement>>('grid');
  private readonly probeRef = viewChild.required<ElementRef<HTMLElement>>('probe');

  protected readonly hintId = `lib-calendar-month-hint-${(nextId++).toString()}`;

  private readonly tick = signal(new Date());
  private readonly today = computed(() => zoneClock(this.timezone(), this.tick()).date);

  protected readonly weekdays = computed(
    () => createDateLocaleInfo(this.locale(), this.firstDayOfWeek()).weekdays,
  );

  protected readonly heading = computed(() => monthLabel(this.anchor(), this.locale()));

  /** Rows a cell has room for, and whether it is too narrow for rows at all. */
  protected readonly capacity = signal(DEFAULT_CAPACITY);
  protected readonly compact = signal(false);

  /** The cell holding the roving tab stop. */
  private readonly focusedDate = signal<DateValue | null>(null);

  /** The half of the layout that does not depend on the cell's size. */
  protected readonly rows = computed<readonly MonthRow[]>(() => {
    const locale = this.locale();
    const month = monthOf(this.anchor());
    const today = this.today();
    const resources = new Map(this.resources().map((resource) => [resource.id, resource]));
    const open = new Set(this.hours().map((entry) => entry.weekday));
    const byDate = new Map<DateValue, MonthCellEvent[]>();
    for (const event of this.events()) {
      const list = byDate.get(event.date) ?? [];
      list.push({
        event,
        resource: event.resourceId === undefined ? null : (resources.get(event.resourceId) ?? null),
        start: timeLabel(event.start, locale),
        end: timeLabel(event.end, locale),
      });
      byDate.set(event.date, list);
    }
    const days = monthGridDays(month, this.firstDayOfWeek());
    const rows: MonthRow[] = [];
    for (let index = 0; index < days.length; index += 7) {
      const week = days.slice(index, index + 7);
      rows.push({
        key: week[0] ?? index.toString(),
        cells: week.map((date) => ({
          date,
          day: Number(date.slice(8)),
          outside: monthOf(date) !== month,
          today: date === today,
          closed: !open.has(isoWeekdayOf(date)),
          label: dayLabel(date, locale),
          events: (byDate.get(date) ?? []).sort(
            (a, b) =>
              (minutesOf(a.event.start) ?? 0) - (minutesOf(b.event.start) ?? 0) ||
              a.event.title.localeCompare(b.event.title),
          ),
        })),
      });
    }
    return rows;
  });

  /** The half that does: the rows trimmed to the measured capacity. */
  protected readonly views = computed<readonly MonthRowView[]>(() => {
    const capacity = this.capacity();
    return this.rows().map((row) => ({
      key: row.key,
      cells: row.cells.map((cell) => {
        const fit = fitList(cell.events, capacity);
        return { cell, visible: fit.visible, hidden: cell.events.slice(fit.visible.length) };
      }),
    }));
  });

  /** The cell that owns the tab stop: the focused one, else today, else the 1st. */
  protected readonly rovingDate = computed(() => {
    const dates = this.rows().flatMap((row) => row.cells.map((cell) => cell.date));
    const focused = this.focusedDate();
    if (focused !== null && dates.includes(focused)) {
      return focused;
    }
    const today = this.today();
    if (dates.includes(today)) {
      return today;
    }
    return `${monthOf(this.anchor())}-01`;
  });

  protected readonly maxDots = MAX_DOTS;

  constructor() {
    afterNextRender(() => {
      const handle = setInterval(() => {
        this.tick.set(new Date());
      }, CLOCK_INTERVAL_MS);
      this.destroyRef.onDestroy(() => {
        clearInterval(handle);
      });
      if (typeof ResizeObserver === 'undefined') {
        return;
      }
      const observer = new ResizeObserver(() => {
        this.measure();
      });
      observer.observe(this.gridRef().nativeElement);
      this.destroyRef.onDestroy(() => {
        observer.disconnect();
      });
    });
  }

  /** The resource and the badge, for a row's accessible name. */
  protected extras(item: MonthCellEvent): string {
    return eventNameSuffix(item.resource, item.event.badge, this.resourceLabel(), item.event.marks);
  }

  protected onCellFocus(cell: MonthCell): void {
    this.focusedDate.set(cell.date);
  }

  protected onDayClick(cell: MonthCell, event: Event): void {
    event.stopPropagation();
    this.dayOpen.emit(cell.date);
  }

  protected onCellDoubleClick(cell: MonthCell, event: MouseEvent): void {
    if (event.target instanceof Element && event.target.closest('button') !== null) {
      return;
    }
    this.slotCreate.emit({ date: cell.date });
  }

  protected onRowClick(item: MonthCellEvent, event: Event): void {
    event.stopPropagation();
    this.openEvent(item.event);
  }

  protected onMoreOpen(event: CalendarEvent, trigger: PopoverTrigger): void {
    trigger.hide();
    this.openEvent(event);
  }

  /** Arrows move the tab stop by a day or a week, `Enter` opens, `Shift`+`Enter` creates. */
  protected onCellKeydown(cell: MonthCell, event: KeyboardEvent): void {
    if (event.target !== event.currentTarget) {
      return;
    }
    const step: Readonly<Record<string, number | undefined>> = {
      ArrowRight: 1,
      ArrowLeft: -1,
      ArrowDown: 7,
      ArrowUp: -7,
    };
    const days = step[event.key];
    if (days !== undefined) {
      event.preventDefault();
      this.moveFocus(addDays(cell.date, days));
      return;
    }
    if (event.key === 'Enter') {
      event.preventDefault();
      if (event.shiftKey) {
        this.slotCreate.emit({ date: cell.date });
      } else {
        this.dayOpen.emit(cell.date);
      }
    }
  }

  /** What a cell's chip stands for, as events for the list. */
  protected hiddenEvents(view: MonthCellView): readonly CalendarEvent[] {
    return view.hidden.map((item) => item.event);
  }

  private openEvent(event: CalendarEvent): void {
    this.selectedEventId.set(event.id);
    this.eventOpen.emit(event);
  }

  private moveFocus(date: DateValue): void {
    const dates = this.rows().flatMap((row) => row.cells.map((cell) => cell.date));
    if (!dates.includes(date)) {
      return;
    }
    this.focusedDate.set(date);
    afterNextRender(
      () => {
        this.gridRef().nativeElement.querySelector<HTMLElement>(`[data-date="${date}"]`)?.focus();
      },
      { injector: this.injector },
    );
  }

  /**
   * Rows per cell and the compact switch, from one cell and one probe.
   *
   * The probe is an empty box sized by the tokens, so the row height and the
   * width floor are read in pixels without parsing a `rem`. Written only on a
   * change, so a sub-pixel tick never re-lays the month.
   */
  private measure(): void {
    const grid = this.gridRef().nativeElement;
    const body = grid.querySelector<HTMLElement>('.mc-body');
    const probe = this.probeRef().nativeElement;
    if (body === null || probe.offsetHeight <= 0) {
      return;
    }
    const capacity = Math.max(1, Math.floor(body.clientHeight / probe.offsetHeight));
    const compact = body.clientWidth < probe.offsetWidth;
    if (capacity !== this.capacity()) {
      this.capacity.set(capacity);
    }
    if (compact !== this.compact()) {
      this.compact.set(compact);
    }
  }
}
