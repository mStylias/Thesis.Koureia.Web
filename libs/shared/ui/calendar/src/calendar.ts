import {
  Component,
  DestroyRef,
  Directive,
  ElementRef,
  afterNextRender,
  computed,
  contentChild,
  effect,
  inject,
  input,
  linkedSignal,
  model,
  output,
  signal,
  untracked,
  viewChild,
  type Signal,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { TranslocoService } from '@jsverse/transloco';
import { isCanonicalDate, type DateValue, type IsoWeekday } from '@ui/date-picker';
import { ProgressBar } from '@ui/progress';
import { SAVED_VIEWS_HEADROOM } from '@ui/saved-views/core';
import { CalendarAgenda } from './agenda/calendar-agenda';
import type {
  CalendarColumn,
  CalendarDayColumns,
  CalendarEvent,
  CalendarHours,
  CalendarPanel,
  CalendarRange,
  CalendarResource,
  CalendarSlide,
  CalendarSlot,
  CalendarTimeScale,
  CalendarView,
  CalendarZoom,
} from './calendar.types';
import { shiftAnchor, viewRange, weekDays, zoneClock } from './core/date-math';
import { rangeLabel } from './core/range-label';
import { toolbarLayout } from './core/toolbar-layout';
import { CalendarFloatingActions } from './floating/calendar-floating-actions';
import { CalendarMonth } from './month/calendar-month';
import { CalendarSidePanel } from './side-panel/calendar-side-panel';
import { CalendarTimeGrid } from './time-grid/calendar-time-grid';
import { CalendarToolbar } from './toolbar/calendar-toolbar';
import type { CalendarNavigation } from './toolbar/calendar-toolbar.types';
import { CalendarYear } from './year/calendar-year';

/** The range label is announced once navigation settles, not per step. */
const LIVE_DELAY_MS = 400;

/** How much time a view spans, finest first. The agenda lists the month the month view draws. */
const VIEW_DEPTH: Readonly<Record<CalendarView, number>> = {
  day: 0,
  week: 1,
  month: 2,
  agenda: 2,
  year: 3,
};

/** Marks the host's saved views, drawn in the toolbar between the two separators. */
@Directive({ selector: '[libCalendarViews]' })
export class CalendarViewsSlot {}

/** Marks the body of the host's filters panel. The calendar never reads its state. */
@Directive({ selector: '[libCalendarFilters]' })
export class CalendarFiltersSlot {}

/** Marks the footer of the filters panel, such as a "clear all" button. */
@Directive({ selector: '[libCalendarFilterActions]' })
export class CalendarFilterActionsSlot {}

function sameRange(a: CalendarRange, b: CalendarRange): boolean {
  return a.start === b.start && a.end === b.end && a.view === b.view;
}

/**
 * A calendar of timed events: a toolbar, a side panel and five views.
 *
 * ```ts
 * import { Calendar, CalendarFiltersSlot, CalendarViewsSlot } from '@ui/calendar';
 * ```
 * ```html
 * <lib-calendar
 *   [events]="events()"
 *   [resources]="resources()"
 *   [hours]="hours()"
 *   [timezone]="timezone"
 *   [loading]="loading()"
 *   createLabel="New booking"
 *   [(view)]="view"
 *   [(anchor)]="anchor"
 *   [(panel)]="panel"
 *   (rangeChange)="load($event)"
 *   (eventOpen)="open($event)"
 *   (slotCreate)="create($event)"
 *   (refresh)="reload()"
 * >
 *   <lib-saved-views libCalendarViews [controller]="views" />
 *   <my-filters libCalendarFilters />
 *   <button libCalendarFilterActions libButton variant="text">Clear all</button>
 * </lib-calendar>
 * ```
 *
 * The calendar holds no data and issues no request. It says which dates it
 * draws through `rangeChange`, draws the events it is given, and emits what
 * the user asked for. Everything it shows is a two-way model, so the host
 * persists what it wants.
 *
 * The toolbar folds by the calendar's own width, never the window's: the side
 * panel narrows the calendar without moving the window. Below the overlay
 * width the panel slides over the calendar instead of pushing it, and an open
 * panel closes when the calendar crosses that width.
 *
 * Three slots: `[libCalendarViews]` for the saved views, `[libCalendarFilters]`
 * for the filters panel and `[libCalendarFilterActions]` for its footer. The
 * saved views read the calendar's layout through `SAVED_VIEWS_HEADROOM`, so a
 * `lib-saved-views` left at `layout="auto"` turns compact as the bar folds.
 */
@Component({
  selector: 'lib-calendar',
  templateUrl: './calendar.html',
  styleUrl: './calendar.scss',
  imports: [
    ProgressBar,
    CalendarAgenda,
    CalendarFloatingActions,
    CalendarMonth,
    CalendarSidePanel,
    CalendarTimeGrid,
    CalendarToolbar,
    CalendarYear,
  ],
  // No translation scope here, not even as a view provider: a multi provider
  // in `viewProviders` still reaches projected content that sits in a host
  // `@if`, and a pipe there would look its keys up in this scope. The parts
  // that have copy provide the scope themselves.
  providers: [
    {
      provide: SAVED_VIEWS_HEADROOM,
      useFactory: (): Signal<number> => inject(Calendar).viewsHeadroom,
    },
  ],
  host: {
    class: 'cal-host',
    '[attr.data-panel-overlay]': 'panelOverlay() ? "" : null',
    // The content's language, for hyphenation and the screen reader's voice.
    '[attr.lang]': 'resolvedLocale()',
  },
})
export class Calendar {
  private readonly transloco = inject(TranslocoService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  /** The events of the range last emitted by `rangeChange`, already filtered by the host. */
  readonly events = input<readonly CalendarEvent[]>([]);

  /** The resources: the per-resource day columns and the swatches everywhere. */
  readonly resources = input<readonly CalendarResource[]>([]);

  /** Open hours per weekday, for the shading and the first scroll. A weekday with none is closed. */
  readonly hours = input<readonly CalendarHours[]>([]);

  /** Per-day counts for the year view. A missing day is zero. */
  readonly dayCounts = input<Readonly<Record<DateValue, number>>>({});

  /** The zone "now" and "today" are read in. Defaults to the browser's. */
  readonly timezone = input(Intl.DateTimeFormat().resolvedOptions().timeZone);

  /** Draws a thin progress bar over the view. */
  readonly loading = input(false);

  /** Spins the refresh button and blocks a second refresh. */
  readonly refreshing = input(false);

  /** Locale for every label. Defaults to the active Transloco language. */
  readonly locale = input('');

  readonly firstDayOfWeek = input<IsoWeekday>(1);

  /** Text of the create button. Falls back to a generic label. */
  readonly createLabel = input('');

  /** Text of the per-resource columns switch in the settings. Falls back to a generic label. */
  readonly dayColumnsLabel = input('');

  /**
   * The host's noun for a resource, spoken before its name in every event's
   * accessible name: "Barber: Nikos P." Empty names the resource alone.
   */
  readonly resourceLabel = input('');

  /** How many filters the host has set. Shown as a count on the Filters button. */
  readonly filtersActive = input(0);

  readonly view = model<CalendarView>('week');

  /** The date the calendar is on, `YYYY-MM-DD`. Empty means today in `timezone`. */
  readonly anchor = model<DateValue>('');

  /** Minutes per row of the time grid. */
  readonly timeScale = model<CalendarTimeScale>(30);

  /** What day view's columns stand for. */
  readonly dayColumns = model<CalendarDayColumns>('single');

  /** Whether tiles show their times. Off by default: the grid's own axis says when. */
  readonly showTime = model(false);

  /** The side panel on show. `null` is closed. */
  readonly panel = model<CalendarPanel>(null);

  /** The event that is open. The views mark it. */
  readonly selectedEventId = model<string | null>(null);

  /** The dates the view draws, on the first render and whenever the view or the anchor moves them. */
  readonly rangeChange = output<CalendarRange>();

  /** One click on an event. */
  readonly eventOpen = output<CalendarEvent>();

  /**
   * A request to create: a double click on empty space, or `Enter` on a
   * selected slot, with the slot; the create button, with `null`.
   */
  readonly slotCreate = output<CalendarSlot | null>();

  readonly refresh = output();

  private readonly toolbarRef = viewChild(CalendarToolbar);

  protected readonly viewsSlot = contentChild(CalendarViewsSlot);
  protected readonly filtersSlot = contentChild(CalendarFiltersSlot);
  protected readonly filterActionsSlot = contentChild(CalendarFilterActionsSlot);

  /** The calendar's own width. Wide until measured, so a server render draws every control. */
  private readonly width = signal(Number.POSITIVE_INFINITY);

  /** Which controls the toolbar draws inline at the calendar's width. */
  readonly layout = computed(() =>
    toolbarLayout(this.width(), { views: this.viewsSlot() !== undefined }),
  );

  /**
   * Whether the side panel slides over the calendar. A host that persists the
   * panel skips an open made in this mode, since it closes on the next
   * crossing anyway.
   */
  readonly panelOverlay = computed(() => this.layout().panelOverlay);

  /** What the saved views may take: the slot's width inline, nothing once they are compact. */
  readonly viewsHeadroom = computed(() =>
    this.layout().views === 'strip'
      ? (this.toolbarRef()?.viewsWidth() ?? Number.POSITIVE_INFINITY)
      : 0,
  );

  private readonly activeLang = toSignal(this.transloco.langChanges$, {
    initialValue: this.transloco.getActiveLang(),
  });

  protected readonly resolvedLocale = computed(() => this.locale() || this.activeLang());

  private readonly today = computed(() => zoneClock(this.timezone()).date);

  /** The anchor, or today while the host has none. */
  protected readonly current = computed(() => {
    const anchor = this.anchor();
    return isCanonicalDate(anchor) ? anchor : this.today();
  });

  protected readonly range = computed(
    () => viewRange(this.current(), this.view(), this.firstDayOfWeek()),
    { equal: sameRange },
  );

  protected readonly label = computed(() =>
    rangeLabel(this.current(), this.view(), this.resolvedLocale(), this.firstDayOfWeek()),
  );

  protected readonly columns = computed<readonly CalendarColumn[]>(() => {
    const date = this.current();
    if (this.view() === 'week') {
      return weekDays(date, this.firstDayOfWeek()).map((day) => ({ date: day }));
    }
    const resources = this.resources();
    return this.dayColumns() === 'perResource' && resources.length > 0
      ? resources.map((resource) => ({ date, resourceId: resource.id }))
      : [{ date }];
  });

  /** Set after the first render, so the view on show at load does not fade in. */
  protected readonly settled = signal(false);

  private readonly slide = signal<CalendarSlide | null>(null);
  private slideCount = 0;

  /** Alternates between two names, so a second step restarts the animation. */
  protected readonly slideKey = computed(() => {
    const slide = this.slide();
    return slide === null ? null : `${slide.direction}-${slide.parity.toString()}`;
  });

  /** The time grid slides its own columns, so its hour labels hold still. The other views slide whole. */
  protected readonly gridSlide = computed(() => (this.isTimeGrid() ? this.slideKey() : null));
  protected readonly stageSlide = computed(() => (this.isTimeGrid() ? null : this.slideKey()));
  private readonly isTimeGrid = computed(() => this.view() === 'day' || this.view() === 'week');

  /**
   * Which way the last view switch went: `in` to a finer view, `out` to a
   * broader one, `none` between the month and its agenda, which show the same
   * dates.
   */
  protected readonly zoom = linkedSignal<CalendarView, CalendarZoom>({
    source: this.view,
    computation: (view, previous) => {
      if (previous === undefined) {
        return 'none';
      }
      const from = VIEW_DEPTH[previous.source];
      const to = VIEW_DEPTH[view];
      return to === from ? 'none' : to < from ? 'in' : 'out';
    },
  });

  protected readonly liveText = signal('');
  private liveTimer: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    effect(() => {
      const range = this.range();
      untracked(() => {
        this.rangeChange.emit(range);
      });
    });

    effect(() => {
      const label = this.label();
      if (!untracked(this.settled)) {
        return;
      }
      untracked(() => {
        this.announce(label);
      });
    });

    afterNextRender(() => {
      this.settled.set(true);
      if (typeof ResizeObserver === 'undefined') {
        return;
      }
      const observer = new ResizeObserver((entries) => {
        const box = entries.at(-1)?.contentRect;
        if (box !== undefined) {
          this.measure(box.width);
        }
      });
      observer.observe(this.host.nativeElement);
      this.destroyRef.onDestroy(() => {
        observer.disconnect();
      });
    });

    this.destroyRef.onDestroy(() => {
      if (this.liveTimer !== null) {
        clearTimeout(this.liveTimer);
      }
    });
  }

  protected onNavigate(navigation: CalendarNavigation): void {
    const from = this.current();
    switch (navigation) {
      case 'today':
        this.goTo(this.today());
        break;
      case 'previous':
        this.goTo(shiftAnchor(from, this.view(), -1));
        break;
      case 'next':
        this.goTo(shiftAnchor(from, this.view(), 1));
        break;
    }
  }

  protected onDateSelect(date: DateValue): void {
    this.goTo(date);
  }

  /** A day number in the month or year view opens that day. */
  protected onDayOpen(date: DateValue): void {
    this.view.set('day');
    this.anchor.set(date);
  }

  /** A month card in the year view opens that month. */
  protected onMonthOpen(date: DateValue): void {
    this.view.set('month');
    this.anchor.set(date);
  }

  protected onEventOpen(event: CalendarEvent): void {
    this.eventOpen.emit(event);
  }

  protected onSlotCreate(slot: CalendarSlot | null): void {
    this.slotCreate.emit(slot);
  }

  /**
   * A slide ends with its own animation: the stage's, or a time grid column's.
   * A tile's or a popover's bubbles up too and is not one.
   */
  protected onSlideEnd(event: AnimationEvent): void {
    if (event.animationName.includes('slide-')) {
      this.slide.set(null);
    }
  }

  /** Moves the anchor, and slides the view when that changes the dates it draws. */
  private goTo(date: DateValue): void {
    const from = this.current();
    if (date === from) {
      return;
    }
    const before = this.range();
    this.anchor.set(date);
    if (!this.settled() || sameRange(before, this.range())) {
      return;
    }
    this.slideCount += 1;
    this.slide.set({ direction: date > from ? 'next' : 'previous', parity: this.slideCount % 2 });
  }

  /** Rounded and written only on a change, so a sub-pixel tick cannot re-lay the bar. */
  private measure(raw: number): void {
    const width = Math.round(raw);
    if (width <= 0 || width === this.width()) {
      return;
    }
    const wasOverlay = this.panelOverlay();
    this.width.set(width);
    // A panel that pushed the calendar would now cover it. Close it rather
    // than open an overlay the user did not ask for.
    if (!wasOverlay && this.panelOverlay()) {
      this.panel.set(null);
    }
  }

  private announce(label: string): void {
    if (this.liveTimer !== null) {
      clearTimeout(this.liveTimer);
    }
    this.liveTimer = setTimeout(() => {
      this.liveTimer = null;
      this.liveText.set(label);
    }, LIVE_DELAY_MS);
  }
}
