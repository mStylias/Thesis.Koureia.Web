import {
  Component,
  DestroyRef,
  ElementRef,
  Injector,
  afterNextRender,
  afterRenderEffect,
  computed,
  inject,
  input,
  model,
  output,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { injectUiCopy, UiCopyPipe } from '@util/ui-copy';
import { PopoverTrigger } from '@ui/popover';
import { CALENDAR_TRANSLOCO_SCOPE } from '../calendar.i18n';
import type {
  CalendarColumn,
  CalendarEvent,
  CalendarHours,
  CalendarResource,
  CalendarSlot,
  CalendarTimeScale,
} from '../calendar.types';
import {
  MINUTES_PER_DAY,
  eventMinutes,
  isoWeekdayOf,
  minutesOf,
  snapMinutes,
  timeOf,
  zoneClock,
} from '../core/date-math';
import { dayHeading, dayLabel, timeLabel } from '../core/range-label';
import { packTimed } from '../core/tile-layout';
import { CalendarMorePopover } from '../more-popover/calendar-more-popover';
import { CalendarTile } from './calendar-tile';
import type {
  TimeGridColumn,
  TimeGridHours,
  TimeGridOverflow,
  TimeGridTile,
} from './calendar-time-grid.types';

/** Past this many side-by-side tiles the rest of a cluster becomes one chip. */
const MAX_TILE_COLUMNS = 4;

/** The now line moves once a minute, as often as the clock it draws. */
const CLOCK_INTERVAL_MS = 60_000;

/** A keyboard walk announces where it stopped, not every step. */
const LIVE_DELAY_MS = 250;

/** Where the grid opens when neither hours nor events say. */
const FALLBACK_SCROLL_MINUTES = 8 * 60;

/** Room above the first open hour, so its label is not cut by the head. */
const SCROLL_LEAD_MINUTES = 15;

let nextId = 0;

/** The bands outside the open hours, and whether there are any hours at all. */
function hoursOf(entry: CalendarHours | undefined): TimeGridHours {
  const open = entry === undefined ? null : minutesOf(entry.open);
  const close = entry === undefined ? null : minutesOf(entry.close);
  if (open === null || close === null || close <= open) {
    return { closed: true, open: null, bands: [{ start: 0, end: MINUTES_PER_DAY }] };
  }
  return {
    closed: false,
    open,
    bands: [
      ...(open > 0 ? [{ start: 0, end: open }] : []),
      ...(close < MINUTES_PER_DAY ? [{ start: close, end: MINUTES_PER_DAY }] : []),
    ],
  };
}

/**
 * Day, week and per-resource day as one grid of timed columns.
 *
 * ```ts
 * import { CalendarTimeGrid } from '@ui/calendar';
 * ```
 * ```html
 * <lib-calendar-time-grid
 *   [columns]="columns()"
 *   [events]="events()"
 *   [resources]="resources()"
 *   [hours]="hours()"
 *   [timeScale]="30"
 *   [timezone]="timezone"
 *   [(selectedEventId)]="openId"
 *   (eventOpen)="open($event)"
 *   (slotCreate)="create($event)"
 * />
 * ```
 *
 * A column is a date, or a date and a resource; the host decides how many
 * there are. The axis is the whole day, with the minutes outside the open
 * hours shaded, and the grid opens scrolled to the first open hour. Events
 * that overlap share their column side by side, up to four; past that the
 * rest sit behind a "+N" chip. One click on a tile opens it, a double click
 * on empty space asks to create there, and the arrow keys do the same from
 * the keyboard. The grid holds no data of its own and issues no request.
 */
@Component({
  selector: 'lib-calendar-time-grid',
  templateUrl: './calendar-time-grid.html',
  styleUrl: './calendar-time-grid.scss',
  imports: [TranslocoPipe, UiCopyPipe, CalendarTile, CalendarMorePopover, PopoverTrigger],
  providers: [CALENDAR_TRANSLOCO_SCOPE],
  host: {
    class: 'tg-host',
    '[style.--tg-slots-per-hour]': 'slotsPerHour()',
    '[style.--tg-columns]': 'columns().length',
    '[attr.data-slide]': 'slide()',
  },
})
export class CalendarTimeGrid {
  private readonly transloco = inject(TranslocoService);
  private readonly copy = injectUiCopy();
  private readonly destroyRef = inject(DestroyRef);
  private readonly injector = inject(Injector);

  /** The columns, left to right: a date each, and a resource in per-resource mode. */
  readonly columns = input.required<readonly CalendarColumn[]>();

  /** The events of the visible dates, already filtered by the host. */
  readonly events = input<readonly CalendarEvent[]>([]);

  /** The resources, for the swatches and the per-resource column heads. */
  readonly resources = input<readonly CalendarResource[]>([]);

  /** Open hours per weekday. Minutes outside them are shaded; a weekday with none is closed. */
  readonly hours = input<readonly CalendarHours[]>([]);

  /** Minutes per row. */
  readonly timeScale = input<CalendarTimeScale>(30);

  /** Whether each tile shows its times. The accessible names carry them either way. */
  readonly showTime = input(false);

  /** The zone "now" is read in, for the now line and the today mark. Defaults to the browser's. */
  readonly timezone = input(Intl.DateTimeFormat().resolvedOptions().timeZone);

  /** Locale for the column heads and the hour labels. */
  readonly locale = input('el');

  /** The host's noun for a resource, spoken before its name. Empty names the resource alone. */
  readonly resourceLabel = input('');

  /**
   * A step in progress, `next-0`, `next-1`, `previous-0` or `previous-1`. The
   * day columns and their heads slide in from that side; the hour labels stay,
   * since the axis did not change. The parity restarts the animation.
   */
  readonly slide = input<string | null>(null);

  /** The event that is open. Two-way, so a click writes it back. */
  readonly selectedEventId = model<string | null>(null);

  /** The empty slot a click or the arrow keys picked. */
  readonly selectedSlot = model<CalendarSlot | null>(null);

  /** A tile was clicked, or a row of a "+N" list. */
  readonly eventOpen = output<CalendarEvent>();

  /** Empty space was double-clicked, or `Enter` was pressed on a selected slot. */
  readonly slotCreate = output<CalendarSlot>();

  private readonly scrollerRef = viewChild.required<ElementRef<HTMLElement>>('scroller');
  private readonly gutterRef = viewChild.required<ElementRef<HTMLElement>>('gutter');
  private readonly slotBandRef = viewChild<ElementRef<HTMLElement>>('slotBand');

  protected readonly hintId = `lib-calendar-time-grid-hint-${(nextId++).toString()}`;
  protected readonly slotsPerHour = computed(() => 60 / this.timeScale());

  /** `01:00` to `23:00`. Midnight is the top edge and gets no label. */
  protected readonly hourLabels = computed(() => {
    const locale = this.locale();
    return Array.from({ length: 23 }, (_, index) => {
      const hour = index + 1;
      return { hour, label: timeLabel(timeOf(hour * 60), locale) };
    });
  });

  private readonly tick = signal(new Date());

  /** The wall clock in `timezone`, refreshed each minute once rendered. */
  protected readonly clock = computed(() => zoneClock(this.timezone(), this.tick()));

  protected readonly liveText = signal('');

  /**
   * How the band of the selected slot fades in: `a` or `b` after a click,
   * alternating so the next click restarts it, `null` after a key.
   */
  protected readonly slotFade = signal<'a' | 'b' | null>(null);

  protected readonly selectedSlotMinutes = computed(() => {
    const slot = this.selectedSlot();
    return slot?.time === undefined ? null : minutesOf(slot.time);
  });

  protected readonly rows = computed<readonly TimeGridColumn[]>(() => {
    const locale = this.locale();
    const scale = this.timeScale();
    const today = this.clock().date;
    const events = this.events();
    const resources = new Map(this.resources().map((resource) => [resource.id, resource]));
    const hours = new Map(this.hours().map((entry) => [entry.weekday, entry]));
    return this.columns().map((column) => {
      const resourceId = column.resourceId ?? null;
      const resource = resourceId === null ? null : (resources.get(resourceId) ?? null);
      const key = `${column.date}|${resourceId ?? ''}`;
      const opening = hoursOf(hours.get(isoWeekdayOf(column.date)));
      const own = events.filter(
        (event) =>
          event.date === column.date && (resourceId === null || event.resourceId === resourceId),
      );
      const byId = new Map(own.map((event) => [event.id, event]));
      const packed = packTimed(
        own.flatMap((event) => {
          const minutes = eventMinutes(event.start, event.end);
          return minutes === null ? [] : [{ id: event.id, ...minutes }];
        }),
        { minMinutes: scale, maxColumns: MAX_TILE_COLUMNS },
      );
      const tiles: TimeGridTile[] = packed.tiles.flatMap((layout) => {
        const event = byId.get(layout.id);
        if (event === undefined) {
          return [];
        }
        const owner =
          resource ??
          (event.resourceId === undefined ? null : (resources.get(event.resourceId) ?? null));
        return [{ event, resource: owner, layout }];
      });
      const overflow: TimeGridOverflow[] = packed.overflow.map((chip, index) => ({
        key: `${key}|${index.toString()}`,
        start: chip.start,
        end: chip.end,
        events: chip.ids.flatMap((id) => {
          const event = byId.get(id);
          return event === undefined ? [] : [event];
        }),
      }));
      return {
        key,
        date: column.date,
        resourceId,
        resource,
        heading: resource?.label ?? dayHeading(column.date, locale),
        label: resource?.label ?? dayLabel(column.date, locale),
        today: column.date === today,
        closed: opening.closed,
        open: opening.open,
        bands: opening.bands,
        tiles,
        overflow,
      };
    });
  });

  /** Minutes at the top of the viewport once the user has scrolled; `null` until then. */
  private topMinutes: number | null = null;

  /** The selection last scrolled to, so a tile is revealed once and never chased. */
  private revealedId: string | null = null;

  /** What the grid last scrolled to itself, so its own scroll is not read as the user's. */
  private expectedScrollTop: number | null = null;

  private liveTimer: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    afterNextRender(() => {
      const handle = setInterval(() => {
        this.tick.set(new Date());
      }, CLOCK_INTERVAL_MS);
      this.destroyRef.onDestroy(() => {
        clearInterval(handle);
      });
      // A grid rendered before it has a height, in a hidden panel or a
      // container still being laid out, cannot be scrolled yet. Until the
      // user scrolls, every size the gutter takes places the scroll again.
      if (typeof ResizeObserver !== 'undefined') {
        const observer = new ResizeObserver(() => {
          if (this.topMinutes === null) {
            this.placeScroll();
          }
        });
        observer.observe(this.gutterRef().nativeElement);
        this.destroyRef.onDestroy(() => {
          observer.disconnect();
        });
      }
    });
    // Opens on the first open hour, and holds the top minute still through a
    // scale change. The hours are tracked because they can arrive after the
    // first paint, and a grid still at its default has no reason to stay there.
    afterRenderEffect(() => {
      this.slotsPerHour();
      this.hours();
      untracked(() => {
        this.placeScroll();
      });
    });
    // A selection the host makes, such as a link or an appointment opened from a list, can be off
    // screen. The rows can arrive after the selection, so this waits for the tile to be drawn.
    afterRenderEffect(() => {
      const id = this.selectedEventId();
      this.rows();
      untracked(() => {
        this.revealSelected(id);
      });
    });
    this.destroyRef.onDestroy(() => {
      if (this.liveTimer !== null) {
        clearTimeout(this.liveTimer);
      }
    });
  }

  protected hasSelectedSlot(column: TimeGridColumn): boolean {
    const slot = this.selectedSlot();
    return (
      slot !== null && slot.date === column.date && (slot.resourceId ?? null) === column.resourceId
    );
  }

  protected timeText(minutes: number): string {
    return timeLabel(timeOf(minutes), this.locale());
  }

  protected onScroll(): void {
    const scroller = this.scrollerRef().nativeElement;
    const height = this.gutterRef().nativeElement.offsetHeight;
    if (height <= 0) {
      return;
    }
    const expected = this.expectedScrollTop;
    this.expectedScrollTop = null;
    if (expected !== null && Math.abs(scroller.scrollTop - expected) < 1) {
      return;
    }
    this.topMinutes = (scroller.scrollTop / height) * MINUTES_PER_DAY;
  }

  protected onTileClick(tile: TimeGridTile, event: Event): void {
    event.stopPropagation();
    this.openEvent(tile.event);
  }

  /** A double click on a tile is two opens, never a request to create under it. */
  protected onTileDoubleClick(event: Event): void {
    event.stopPropagation();
  }

  protected onMoreOpen(event: CalendarEvent, trigger: PopoverTrigger): void {
    trigger.hide();
    this.openEvent(event);
  }

  protected onColumnClick(column: TimeGridColumn, event: MouseEvent): void {
    const slot = this.slotAt(column, event);
    if (slot !== null && this.selectSlot(slot)) {
      this.slotFade.update((fade) => (fade === 'a' ? 'b' : 'a'));
    }
  }

  protected onColumnDoubleClick(column: TimeGridColumn, event: MouseEvent): void {
    const slot = this.slotAt(column, event);
    if (slot !== null) {
      this.selectSlot(slot);
      this.slotCreate.emit(slot);
    }
  }

  /**
   * The arrow keys walk the column one row at a time, `Enter` creates on the
   * selected row, `Escape` lets go of it. Keys typed inside a tile are the
   * tile's own.
   */
  protected onColumnKeydown(column: TimeGridColumn, event: KeyboardEvent): void {
    if (event.target !== event.currentTarget) {
      return;
    }
    this.slotFade.set(null);
    const scale = this.timeScale();
    const current = this.hasSelectedSlot(column) ? this.selectedSlotMinutes() : null;
    switch (event.key) {
      case 'ArrowDown':
      case 'ArrowUp': {
        event.preventDefault();
        const step = event.key === 'ArrowDown' ? scale : -scale;
        const from = current === null ? (column.open ?? FALLBACK_SCROLL_MINUTES) : current + step;
        const minutes = snapMinutes(from, scale);
        this.selectSlot(this.slotFor(column, minutes));
        this.announce(minutes);
        this.revealSlotBand();
        break;
      }
      case 'Enter':
        if (current !== null) {
          event.preventDefault();
          this.slotCreate.emit(this.slotFor(column, current));
        }
        break;
      case 'Escape':
        if (current !== null) {
          event.preventDefault();
          this.selectedSlot.set(null);
        }
        break;
      default:
        break;
    }
  }

  private openEvent(event: CalendarEvent): void {
    this.selectedSlot.set(null);
    this.selectedEventId.set(event.id);
    this.eventOpen.emit(event);
  }

  /**
   * Idempotent: the same slot again writes nothing, so a double click is one
   * selection. Says whether the selection changed.
   */
  private selectSlot(slot: CalendarSlot): boolean {
    const current = this.selectedSlot();
    if (
      current !== null &&
      current.date === slot.date &&
      current.time === slot.time &&
      current.resourceId === slot.resourceId
    ) {
      return false;
    }
    this.selectedEventId.set(null);
    this.selectedSlot.set(slot);
    return true;
  }

  /** The slot under the pointer, or `null` when the press landed on a tile or a chip. */
  private slotAt(column: TimeGridColumn, event: MouseEvent): CalendarSlot | null {
    const surface = event.currentTarget;
    if (
      !(surface instanceof HTMLElement) ||
      (event.target instanceof Element && event.target.closest('button') !== null)
    ) {
      return null;
    }
    const rect = surface.getBoundingClientRect();
    if (rect.height <= 0) {
      return null;
    }
    const minutes = ((event.clientY - rect.top) / rect.height) * MINUTES_PER_DAY;
    return this.slotFor(column, snapMinutes(minutes, this.timeScale()));
  }

  private slotFor(column: TimeGridColumn, minutes: number): CalendarSlot {
    const slot: CalendarSlot = { date: column.date, time: timeOf(minutes) };
    return column.resourceId === null ? slot : { ...slot, resourceId: column.resourceId };
  }

  private placeScroll(): void {
    const scroller = this.scrollerRef().nativeElement;
    const height = this.gutterRef().nativeElement.offsetHeight;
    if (height <= 0) {
      return;
    }
    const minutes = this.topMinutes ?? Math.max(0, this.initialMinutes() - SCROLL_LEAD_MINUTES);
    const top = Math.round((minutes / MINUTES_PER_DAY) * height);
    this.expectedScrollTop = top;
    scroller.scrollTop = top;
  }

  /** The earliest open hour on view, else the earliest event, else eight o'clock. */
  private initialMinutes(): number {
    const rows = this.rows();
    const opens = rows.flatMap((column) => (column.open === null ? [] : [column.open]));
    if (opens.length > 0) {
      return Math.min(...opens);
    }
    const starts = rows.flatMap((column) => column.tiles.map((tile) => tile.layout.start));
    return starts.length > 0 ? Math.min(...starts) : FALLBACK_SCROLL_MINUTES;
  }

  private announce(minutes: number): void {
    if (this.liveTimer !== null) {
      clearTimeout(this.liveTimer);
    }
    this.liveTimer = setTimeout(() => {
      this.liveTimer = null;
      this.liveText.set(
        this.transloco.translate(this.copy('calendar.slotSelected'), {
          time: this.timeText(minutes),
        }),
      );
    }, LIVE_DELAY_MS);
  }

  /** `nearest`, so a tile already in view does not move: a click reveals nothing. */
  private revealSelected(id: string | null): void {
    if (id === null) {
      this.revealedId = null;
      return;
    }
    if (id === this.revealedId) {
      return;
    }
    const tile = this.scrollerRef().nativeElement.querySelector('[libCalendarTile][data-selected]');
    if (!(tile instanceof HTMLElement)) {
      return;
    }
    this.revealedId = id;
    try {
      tile.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    } catch {
      // No layout, so nothing to reveal.
    }
  }

  /** After the render that draws the band, since the keyboard cannot see it. */
  private revealSlotBand(): void {
    afterNextRender(
      () => {
        try {
          this.slotBandRef()?.nativeElement.scrollIntoView({ block: 'nearest' });
        } catch {
          // No layout, so nothing to reveal.
        }
      },
      { injector: this.injector },
    );
  }
}
