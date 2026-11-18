import {
  Component,
  DestroyRef,
  ElementRef,
  afterNextRender,
  afterRenderEffect,
  computed,
  inject,
  input,
  model,
  output,
  signal,
  untracked,
} from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { UiCopyPipe } from '@util/ui-copy';
import type { DateValue } from '@ui/date-picker';
import { CALENDAR_TRANSLOCO_SCOPE } from '../calendar.i18n';
import type { CalendarEvent, CalendarResource } from '../calendar.types';
import { minutesOf, monthOf, zoneClock } from '../core/date-math';
import { eventNameSuffix } from '../core/event-label';
import { CalendarMarks } from '../marks/calendar-marks';
import { dayLabel, timeLabel } from '../core/range-label';
import type { AgendaGroup, AgendaRow } from './calendar-agenda.types';

const CLOCK_INTERVAL_MS = 60_000;

let nextId = 0;

/**
 * The month as a list, grouped by day.
 *
 * ```html
 * <lib-calendar-agenda
 *   [anchor]="anchor()"
 *   [events]="events()"
 *   [resources]="resources()"
 *   [(selectedEventId)]="openId"
 *   (eventOpen)="open($event)"
 * />
 * ```
 *
 * Days with nothing are skipped, and a month with nothing says so. Day heads
 * stick while their rows scroll under them. When the month is the current
 * one, the list opens on today.
 */
@Component({
  selector: 'lib-calendar-agenda',
  templateUrl: './calendar-agenda.html',
  styleUrl: './calendar-agenda.scss',
  imports: [CalendarMarks, TranslocoPipe, UiCopyPipe],
  providers: [CALENDAR_TRANSLOCO_SCOPE],
  host: { class: 'ag-host' },
})
export class CalendarAgenda {
  private readonly destroyRef = inject(DestroyRef);
  private readonly elementRef = inject<ElementRef<HTMLElement>>(ElementRef);

  /** Any date of the month to list. */
  readonly anchor = input.required<DateValue>();

  /** The events of the month, already filtered by the host. */
  readonly events = input<readonly CalendarEvent[]>([]);

  /** The resources, for the swatches. */
  readonly resources = input<readonly CalendarResource[]>([]);

  /** The zone "today" is read in. Defaults to the browser's. */
  readonly timezone = input(Intl.DateTimeFormat().resolvedOptions().timeZone);

  readonly locale = input('el');

  /** The host's noun for a resource, spoken before its name. Empty names the resource alone. */
  readonly resourceLabel = input('');

  /** The event that is open. Two-way, so a click writes it back. */
  readonly selectedEventId = model<string | null>(null);

  /** A row was clicked. */
  readonly eventOpen = output<CalendarEvent>();

  protected readonly listId = `lib-calendar-agenda-${(nextId++).toString()}`;

  private readonly tick = signal(new Date());
  private readonly today = computed(() => zoneClock(this.timezone(), this.tick()).date);

  protected readonly groups = computed<readonly AgendaGroup[]>(() => {
    const locale = this.locale();
    const month = monthOf(this.anchor());
    const today = this.today();
    const resources = new Map(this.resources().map((resource) => [resource.id, resource]));
    const byDate = new Map<DateValue, AgendaRow[]>();
    for (const event of this.events()) {
      if (monthOf(event.date) !== month) {
        continue;
      }
      const rows = byDate.get(event.date) ?? [];
      rows.push({
        event,
        resource: event.resourceId === undefined ? null : (resources.get(event.resourceId) ?? null),
        start: timeLabel(event.start, locale),
        end: timeLabel(event.end, locale),
      });
      byDate.set(event.date, rows);
    }
    return [...byDate.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, rows]) => ({
        date,
        label: dayLabel(date, locale),
        today: date === today,
        rows: rows.sort(
          (a, b) =>
            (minutesOf(a.event.start) ?? 0) - (minutesOf(b.event.start) ?? 0) ||
            a.event.title.localeCompare(b.event.title),
        ),
      }));
  });

  constructor() {
    afterNextRender(() => {
      const handle = setInterval(() => {
        this.tick.set(new Date());
      }, CLOCK_INTERVAL_MS);
      this.destroyRef.onDestroy(() => {
        clearInterval(handle);
      });
    });
    // On today, once per month shown. Not on every render: the list would
    // jump back while the user reads another day.
    afterRenderEffect(() => {
      this.anchor();
      untracked(() => {
        this.revealToday();
      });
    });
  }

  /** The resource and the badge, for a row's accessible name. */
  protected extras(row: AgendaRow): string {
    return eventNameSuffix(row.resource, row.event.badge, this.resourceLabel(), row.event.marks);
  }

  protected onRowClick(row: AgendaRow): void {
    this.selectedEventId.set(row.event.id);
    this.eventOpen.emit(row.event);
  }

  private revealToday(): void {
    const today = this.today();
    if (monthOf(today) !== monthOf(this.anchor())) {
      return;
    }
    try {
      this.elementRef.nativeElement
        .querySelector<HTMLElement>(`[data-date="${today}"]`)
        ?.scrollIntoView({ block: 'start' });
    } catch {
      // No layout, so nothing to reveal.
    }
  }
}
