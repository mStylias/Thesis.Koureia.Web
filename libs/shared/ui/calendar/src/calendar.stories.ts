import { Component, computed, input, linkedSignal, signal } from '@angular/core';
import { provideTransloco } from '@jsverse/transloco';
import { applicationConfig, moduleMetadata, type Meta, type StoryObj } from '@storybook/angular';
import { Button } from '@ui/button';
import { addDays, todayLocal, type DateValue } from '@ui/date-picker';
import { MultiSelect } from '@ui/multi-select';
import { SavedViews } from '@ui/saved-views';
import {
  SAVED_VIEWS_VERSION,
  SavedViewsController,
  memorySavedViewsStorage,
} from '@ui/saved-views/core';
import type { SelectOption } from '@ui/select';
import {
  Calendar,
  CalendarFilterActionsSlot,
  CalendarFiltersSlot,
  CalendarViewsSlot,
} from './calendar';
import type {
  CalendarDayColumns,
  CalendarEvent,
  CalendarPanel,
  CalendarRange,
  CalendarSlot,
  CalendarTimeScale,
  CalendarView,
} from './calendar.types';
import { monthOf, yearOf } from './core/date-math';
import {
  DEMO_HOURS,
  DEMO_RESOURCES,
  demoDayCounts,
  demoMonthEvents,
} from './demo/calendar-demo-data';
import type { DemoSeatsState } from './demo/calendar-demo-data.types';

const doc = (markdown: string, code: string, language = 'html') => ({
  docs: {
    description: { story: markdown },
    source: { code: code.trim(), language },
  },
});

function isDemoSeatsState(value: unknown): value is DemoSeatsState {
  return (
    typeof value === 'object' && value !== null && Array.isArray((value as DemoSeatsState).seats)
  );
}

const STORAGE = memorySavedViewsStorage({
  calendar_demo_views: {
    version: SAVED_VIEWS_VERSION,
    views: [
      { id: 'all', name: 'Όλες οι θέσεις', state: { seats: [] } },
      { id: 'front', name: 'Μπροστά', state: { seats: ['a'] } },
      { id: 'back', name: 'Πίσω', state: { seats: ['b', 'c'] } },
    ],
  },
});

/**
 * Fictional demo content for every month the range touches. A month's demo
 * grid also covers the days around it, so each month keeps only its own days.
 */
function eventsFor(range: CalendarRange): readonly CalendarEvent[] {
  const months = new Set([monthOf(range.start), monthOf(addDays(range.end, -1))]);
  return [...months].flatMap((month) =>
    demoMonthEvents(`${month}-15`).filter(
      (event) =>
        monthOf(event.date) === month && event.date >= range.start && event.date < range.end,
    ),
  );
}

@Component({
  selector: 'lib-calendar-demo',
  imports: [
    Button,
    Calendar,
    CalendarFilterActionsSlot,
    CalendarFiltersSlot,
    CalendarViewsSlot,
    MultiSelect,
    SavedViews,
  ],
  template: `
    <div
      class="calendar-demo-frame"
      [style.width]="width()"
      [style.resize]="resizable() ? 'horizontal' : null"
      style="box-sizing: border-box; height: 44rem; max-width: 100%; min-width: 20rem;
        padding: 0.75rem; overflow: hidden; border: 1px dashed var(--border);"
    >
      <lib-calendar
        [events]="shownEvents()"
        [resources]="resources"
        [hours]="hours"
        [dayCounts]="dayCounts()"
        [loading]="loading()"
        [filtersActive]="seats().length > 0 ? 1 : 0"
        createLabel="Νέα κράτηση"
        dayColumnsLabel="Μία στήλη ανά θέση"
        [(view)]="view"
        [(anchor)]="anchor"
        [(panel)]="panel"
        [(timeScale)]="timeScale"
        [(dayColumns)]="dayColumns"
        (rangeChange)="onRange($event)"
        (eventOpen)="status.set('Άνοιγμα: ' + $event.title)"
        (slotCreate)="onCreate($event)"
        (refresh)="onRefresh()"
      >
        @if (withViews()) {
          <lib-saved-views libCalendarViews [controller]="views" />
        }
        <div libCalendarFilters style="display: grid; gap: 0.5rem;">
          <label for="calendar-demo-seats" style="font-weight: 500;">Θέσεις</label>
          <lib-multi-select
            inputId="calendar-demo-seats"
            display="chip"
            placeholder="Όλες οι θέσεις"
            [options]="seatOptions"
            [(value)]="seats"
          />
        </div>
        @if (seats().length > 0) {
          <button
            libCalendarFilterActions
            libButton
            type="button"
            variant="text"
            severity="secondary"
            size="sm"
            (click)="seats.set([])"
          >
            Καθάρισε τα φίλτρα
          </button>
        }
      </lib-calendar>
    </div>
    <p style="margin: 0.75rem 0 0; color: var(--text-secondary);">{{ status() }}</p>
  `,
})
class CalendarDemo {
  readonly width = input('100%');
  readonly resizable = input(false);
  readonly startView = input<CalendarView>('week');
  readonly startColumns = input<CalendarDayColumns>('single');
  readonly withViews = input(true);
  readonly alwaysLoading = input(false);

  readonly resources = DEMO_RESOURCES;
  readonly hours = DEMO_HOURS;
  readonly seatOptions: readonly SelectOption<string>[] = DEMO_RESOURCES.map((resource) => ({
    value: resource.id,
    label: resource.label,
  }));

  readonly view = linkedSignal(() => this.startView());
  readonly dayColumns = linkedSignal(() => this.startColumns());
  readonly anchor = signal<DateValue>(todayLocal());
  readonly panel = signal<CalendarPanel>(null);
  readonly timeScale = signal<CalendarTimeScale>(30);
  readonly seats = signal<string[]>([]);
  readonly status = signal('Κάνε κλικ σε μια καταχώρηση, ή διπλό κλικ σε κενό χώρο.');

  private readonly events = signal<readonly CalendarEvent[]>([]);
  private readonly settling = signal(false);
  private readonly year = signal(yearOf(todayLocal()));
  private timer: ReturnType<typeof setTimeout> | null = null;

  protected readonly loading = computed(() => this.alwaysLoading() || this.settling());
  protected readonly dayCounts = computed(() => demoDayCounts(this.year()));

  /** The host filters; the calendar draws what it is given. */
  protected readonly shownEvents = computed(() => {
    const seats = this.seats();
    const events = this.events();
    return seats.length === 0
      ? events
      : events.filter(
          (event) => event.resourceId !== undefined && seats.includes(event.resourceId),
        );
  });

  readonly views = new SavedViewsController<DemoSeatsState>({
    key: () => 'calendar_demo_views',
    storage: () => STORAGE,
    state: () => ({ seats: this.seats() }),
    apply: (state) => {
      this.seats.set([...state.seats]);
    },
    isDestroyed: () => false,
    isState: isDemoSeatsState,
    statesEqual: (a, b) => a.seats.join() === b.seats.join(),
  });

  constructor() {
    void this.views.load('calendar_demo_views');
  }

  /** A fetch that takes a moment, so the progress bar shows; the old events stay meanwhile. */
  protected onRange(range: CalendarRange): void {
    this.year.set(yearOf(range.start));
    this.settling.set(true);
    if (this.timer !== null) {
      clearTimeout(this.timer);
    }
    this.timer = setTimeout(() => {
      this.timer = null;
      this.events.set(eventsFor(range));
      this.settling.set(false);
    }, 450);
  }

  protected onRefresh(): void {
    this.status.set('Ανανέωση');
  }

  protected onCreate(slot: CalendarSlot | null): void {
    this.status.set(
      slot === null
        ? 'Δημιουργία από το κουμπί'
        : `Δημιουργία: ${slot.date} ${slot.time ?? ''} ${slot.resourceId ?? ''}`.trim(),
    );
  }
}

const meta: Meta<CalendarDemo> = {
  title: 'Layout & Navigation/Calendar/Calendar',
  component: CalendarDemo,
  decorators: [
    moduleMetadata({ imports: [CalendarDemo] }),
    applicationConfig({
      providers: [
        provideTransloco({
          config: {
            availableLangs: ['el', 'en'],
            defaultLang: 'el',
            fallbackLang: 'en',
            reRenderOnLangChange: true,
          },
        }),
      ],
    }),
  ],
  parameters: { layout: 'padded' },
};

export default meta;

const USAGE = `
<lib-calendar
  [events]="events()"
  [resources]="resources()"
  [hours]="hours()"
  [dayCounts]="dayCounts()"
  [timezone]="timezone"
  [loading]="loading()"
  [filtersActive]="activeFilters()"
  createLabel="Νέα κράτηση"
  [(view)]="view"
  [(anchor)]="anchor"
  [(panel)]="panel"
  (rangeChange)="load($event)"
  (eventOpen)="open($event)"
  (slotCreate)="create($event)"
  (refresh)="reload()"
>
  <lib-saved-views libCalendarViews [controller]="views" />
  <my-filters libCalendarFilters />
  @if (activeFilters() > 0) {
    <button libCalendarFilterActions libButton variant="text" (click)="clear()">
      Καθάρισε τα φίλτρα
    </button>
  }
</lib-calendar>
`;

export const Default: StoryObj<CalendarDemo> = {
  render: () => ({ template: '<lib-calendar-demo />' }),
  parameters: doc(
    [
      'The whole calendar: toolbar, side panel and views. It emits `rangeChange` on the first',
      'render and on every step; the host fetches and hands the events back. `Filters` and the',
      'settings button share one push drawer, and pressing the other button swaps the body in',
      'place. The saved views sit between the two separators.',
    ].join(' '),
    USAGE,
  ),
};

export const DayPerResource: StoryObj<CalendarDemo> = {
  render: () => ({
    template: '<lib-calendar-demo startView="day" startColumns="perResource" />',
  }),
  parameters: doc(
    'Day view with one column per resource. The switch lives in the settings panel, in day view only.',
    USAGE.replace('[(view)]="view"', 'view="day" dayColumns="perResource"'),
  ),
};

export const Month: StoryObj<CalendarDemo> = {
  render: () => ({ template: '<lib-calendar-demo startView="month" />' }),
  parameters: doc('The month view. A day number opens that day in day view.', USAGE),
};

export const NarrowHost: StoryObj<CalendarDemo> = {
  render: () => ({ template: '<lib-calendar-demo width="22.5rem" />' }),
  parameters: doc(
    [
      'A phone-width host. The toolbar keeps Today as an icon, the steps, the range and the',
      'date field, and folds everything else behind the "more" button: the view select, the',
      'saved views in their compact field, Filters, the settings, refresh and create. The side',
      'panel slides over the calendar here instead of pushing it.',
    ].join(' '),
    USAGE,
  ),
};

export const ResizableHost: StoryObj<CalendarDemo> = {
  render: () => ({ template: '<lib-calendar-demo [resizable]="true" width="72rem" />' }),
  parameters: doc(
    [
      "Drag the bottom-right corner of the frame. The toolbar folds by the calendar's own width,",
      "never the window's, one control per threshold: the view buttons become a select, then",
      'refresh, the settings, Filters and the saved views move to the "more" panel, then Today',
      'loses its word and create folds last.',
    ].join(' '),
    USAGE,
  ),
};

export const WithoutSavedViews: StoryObj<CalendarDemo> = {
  render: () => ({ template: '<lib-calendar-demo [withViews]="false" />' }),
  parameters: doc(
    'No `[libCalendarViews]` slot. The width the views would take goes back to the controls, so they fold later.',
    USAGE.replace('  <lib-saved-views libCalendarViews [controller]="views" />\n', ''),
  ),
};

export const Loading: StoryObj<CalendarDemo> = {
  render: () => ({ template: '<lib-calendar-demo [alwaysLoading]="true" />' }),
  parameters: doc(
    'While `loading` is set a thin bar runs over the view, and the events on show stay until new ones arrive.',
    USAGE,
  ),
};
