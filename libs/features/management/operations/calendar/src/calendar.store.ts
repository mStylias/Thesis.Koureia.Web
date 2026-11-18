import {
  DestroyRef,
  Service,
  computed,
  effect,
  inject,
  linkedSignal,
  signal,
  untracked,
} from '@angular/core';
import { rxResource, toSignal } from '@angular/core/rxjs-interop';
import { TranslocoService } from '@jsverse/transloco';
import {
  EMPTY,
  Subject,
  catchError,
  concatMap,
  debounceTime,
  firstValueFrom,
  map,
  tap,
  type Observable,
} from 'rxjs';
import {
  AppointmentsApi,
  type AppointmentDayCount,
  type AppointmentsQuery,
} from '@api/appointments';
import { UserResourcesApi } from '@api/user-resources';
import { StaffAccessStore } from '@auth/data-access';
import { SyntheticErrorCodes, type HttpError, type Result } from '@synax/client/core';
import { zoneClock } from '@ui/calendar';
import type {
  CalendarDayColumns,
  CalendarEvent,
  CalendarPanel,
  CalendarRange,
  CalendarTimeScale,
  CalendarView,
} from '@ui/calendar';
import type { DateValue } from '@ui/date-picker';

import {
  customersSource,
  isAppointmentStatus,
  statusLabelKey,
} from '@features/management-shared-appointments';
import {
  CALENDAR_APPOINTMENT_FIELDS,
  appointmentsQueryEqual,
  countActiveFilters,
  emptyFilters,
  matchesFilters,
  toAppointmentsQuery,
  toCalendarEvent,
  toCalendarHours,
  toCalendarResources,
  toDayCounts,
  visibleResources,
} from './calendar-mapping';
import {
  readKeptPanel,
  readKeptSettings,
  writeKeptPanel,
  writeKeptSettings,
} from './calendar-browser-storage';
import {
  DEFAULT_SETTINGS,
  SETTINGS_RESOURCE,
  copyFilters,
  readSettings,
  settingsEqual,
  viewStatesEqual,
} from './calendar-settings';
import { positionParams } from './calendar-url';

import type {
  AppointmentsQueryResult,
  CalendarEventCopy,
  CalendarFilters,
  CalendarPosition,
  CalendarPositionParams,
  CalendarSettings,
  CalendarViewState,
  LoadedAppointments,
  ShopScoped,
} from './calendar.types';

/** Stands in when a request produced no result at all, so there is no problem document. */
const UNREACHABLE: HttpError = {
  errorCode: SyntheticErrorCodes.Unknown,
  httpCode: 0,
  validationErrors: [],
};

/** How long the settings wait for the user to stop changing them before one write. */
const SETTINGS_DEBOUNCE_MS = 400;

/**
 * The calendar page's state: where it stands, what it filters, what it has loaded and what it
 * persists.
 *
 * `autoProvided: false` and provided by `CalendarPage`, so each visit starts a new store. The
 * appointment panel, a child route in the page's outlet, reads the same one.
 *
 * The book is fetched for whatever is drawn, from the first frame. The first frame draws the
 * settings this browser last showed. The persisted settings and the default saved view land
 * later, in {@link hydrate}, and a range or a filter they change fetches again.
 */
@Service({ autoProvided: false })
export class CalendarStore {
  private readonly api = inject(AppointmentsApi);
  private readonly userResources = inject(UserResourcesApi);
  private readonly access = inject(StaffAccessStore);
  private readonly transloco = inject(TranslocoService);
  private readonly destroyRef = inject(DestroyRef);

  /**
   * The shop the API reads for this account. `null` when it works for none, which keeps every
   * resource idle. A reload key, never a URL part: a superadmin's shop change refetches it all.
   */
  readonly companyId = computed(() => this.access.company()?.id ?? null);

  private readonly language = toSignal(this.transloco.langChanges$, {
    initialValue: this.transloco.getActiveLang(),
  });

  /** `null` on the first visit from this browser. Must be declared before the signals it seeds. */
  private readonly keptSettings = readKeptSettings();
  private readonly firstSettings = this.keptSettings ?? DEFAULT_SETTINGS;

  readonly view = signal<CalendarView>(this.firstSettings.view);
  /** `''` means today in the shop's time zone. */
  readonly anchor = signal<DateValue>('');
  readonly timeScale = signal<CalendarTimeScale>(this.firstSettings.timeScale);
  readonly dayColumns = signal<CalendarDayColumns>(this.firstSettings.dayColumns);
  readonly showTime = signal(this.firstSettings.showTime);
  /** The panel as persisted. An open made while the panel overlays the calendar is not kept. */
  private readonly keptPanel = signal<CalendarPanel>(readKeptPanel());

  /** Read before the first draw, so a panel left open is open on the first frame. */
  readonly panel = signal<CalendarPanel>(this.keptPanel());
  readonly selectedId = signal<string | null>(null);

  /** The filters form edits this signal directly. */
  readonly filters = signal<CalendarFilters>(emptyFilters());
  readonly filtersActive = computed(() => countActiveFilters(this.filters()));

  /** Set once the persisted settings and the default view are applied. */
  readonly ready = signal(false);

  private readonly range = signal<CalendarRange | null>(null);

  readonly position = computed<CalendarPosition>(() => ({
    view: this.view(),
    anchor: this.anchor(),
    dayColumns: this.dayColumns(),
  }));

  readonly positionParams = computed(() => positionParams(this.position()));

  /** The arrangement a saved view stores. */
  readonly viewState = computed<CalendarViewState>(() => ({
    version: 1,
    filters: this.filters(),
    view: this.view(),
    timeScale: this.timeScale(),
    dayColumns: this.dayColumns(),
    showTime: this.showTime(),
  }));

  private readonly optionsResource = rxResource({
    params: () => {
      const companyId = this.companyId();
      return companyId === null ? undefined : { companyId, language: this.language() };
    },
    stream: ({ params }) => this.api.calendarOptions(params.language),
  });

  private readonly options = computed(() => {
    const result = this.optionsResource.hasValue() ? this.optionsResource.value() : undefined;
    return result?.isSuccess ? result.data : null;
  });

  readonly timezone = computed(
    () => this.options()?.timezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone,
  );
  readonly hours = computed(() => toCalendarHours(this.options()?.businessHours ?? []));
  readonly roster = computed(() => this.options()?.staffMembers ?? []);
  readonly categories = computed(() => this.options()?.serviceCategories ?? []);

  /** Every barber, active or not, with a swatch that does not move when the filters do. */
  readonly allResources = computed(() => toCalendarResources(this.roster()));

  readonly customers = computed(() => {
    const companyId = this.companyId();
    return companyId === null ? undefined : customersSource(this.api);
  });

  /** The book for the drawn range, except in year view, which reads counts only. */
  private readonly appointmentsQuery = computed<AppointmentsQuery | null>(
    () => {
      const range = this.range();
      if (range === null || range.view === 'year') return null;
      return toAppointmentsQuery(range, this.filters());
    },
    { equal: nullableQueryEqual },
  );

  private readonly appointmentsResource = rxResource({
    params: () => {
      const companyId = this.companyId();
      const query = this.appointmentsQuery();
      return companyId === null || query === null
        ? undefined
        : { companyId, query, language: this.language() };
    },
    stream: ({ params }) =>
      this.api
        .appointments(params.query, params.language, CALENDAR_APPOINTMENT_FIELDS)
        .pipe(map((result): AppointmentsQueryResult => ({ query: params.query, result }))),
  });

  /**
   * The last successful load. It survives a new request, so the calendar keeps drawing while
   * the next range loads. {@link events} narrows it to what the current range and filters show.
   * A shop change drops it: another shop's rows must not stand in for this one's.
   */
  private readonly loaded = linkedSignal<
    ShopScoped<AppointmentsQueryResult>,
    LoadedAppointments | null
  >({
    source: () => ({
      companyId: this.companyId(),
      value: this.appointmentsResource.hasValue() ? this.appointmentsResource.value() : undefined,
    }),
    computation: ({ companyId, value: response }, previous) => {
      if (response?.result.isSuccess) {
        return {
          from: response.query.from,
          to: response.query.to,
          rows: response.result.data ?? [],
        };
      }
      return previous?.source.companyId === companyId ? previous.value : null;
    },
  });

  private readonly eventCopy = computed<CalendarEventCopy>(() => {
    this.language();
    return {
      status: (status) =>
        isAppointmentStatus(status) ? this.transloco.translate(statusLabelKey(status)) : status,
      blocked: this.transloco.translate('managementAppointments.customerMarks.blocked'),
      note: this.transloco.translate('managementAppointments.customerMarks.note'),
    };
  });

  readonly events = computed<readonly CalendarEvent[]>(() => {
    const loaded = this.loaded();
    const range = this.range();
    if (loaded === null || range === null) return [];
    const filters = this.filters();
    const copy = this.eventCopy();
    return loaded.rows
      .filter(
        (row) =>
          row.localDate >= range.start && row.localDate < range.end && matchesFilters(row, filters),
      )
      .map((row) => toCalendarEvent(row, copy));
  });

  /** The columns of per-barber day view, and the swatches everywhere. */
  readonly resources = computed(() =>
    visibleResources(
      this.allResources(),
      this.roster(),
      this.filters().barberIds,
      new Set(this.events().flatMap((event) => event.resourceId ?? [])),
    ),
  );

  private readonly countsQuery = computed<AppointmentsQuery | null>(
    () => {
      const range = this.range();
      if (range?.view !== 'year') return null;
      return toAppointmentsQuery(range, this.filters());
    },
    { equal: nullableQueryEqual },
  );

  private readonly countsResource = rxResource({
    params: () => {
      const companyId = this.companyId();
      const query = this.countsQuery();
      return companyId === null || query === null ? undefined : { companyId, query };
    },
    stream: ({ params }) => this.api.dayCounts(params.query),
  });

  readonly dayCounts = linkedSignal<
    ShopScoped<Result<readonly AppointmentDayCount[]>>,
    Readonly<Record<DateValue, number>>
  >({
    source: () => ({
      companyId: this.companyId(),
      value: this.countsResource.hasValue() ? this.countsResource.value() : undefined,
    }),
    computation: ({ companyId, value: result }, previous) => {
      if (result?.isSuccess) return toDayCounts(result.data ?? []);
      return previous?.source.companyId === companyId ? previous.value : {};
    },
  });

  readonly loading = computed(
    () =>
      this.optionsResource.isLoading() ||
      this.appointmentsResource.isLoading() ||
      this.countsResource.isLoading(),
  );

  private readonly refreshRequested = signal(false);

  /** A reload the user asked for, which spins the refresh icon. */
  readonly refreshing = computed(() => this.refreshRequested() && this.loading());

  /** Why the page cannot show what it was asked for, or `null`. */
  readonly loadError = computed<HttpError | null>(() => {
    const options = this.optionsResource;
    if (options.error() !== undefined) return UNREACHABLE;
    const optionsResult = options.hasValue() ? options.value() : undefined;
    if (optionsResult?.isFailure) return optionsResult.error;

    const book = this.appointmentsResource;
    if (book.error() !== undefined) return UNREACHABLE;
    const response = book.hasValue() ? book.value() : undefined;
    if (response?.result.isFailure) return response.result.error;

    const counts = this.countsResource;
    if (counts.error() !== undefined) return UNREACHABLE;
    const countsResult = counts.hasValue() ? counts.value() : undefined;
    return countsResult?.isFailure ? countsResult.error : null;
  });

  private readonly settings = computed<CalendarSettings>(
    () => ({
      version: 1,
      view: this.view(),
      timeScale: this.timeScale(),
      dayColumns: this.dayColumns(),
      showTime: this.showTime(),
    }),
    { equal: settingsEqual },
  );

  /** The settings resource's id. `null` means none is stored yet. */
  private settingsId: string | null = null;

  /** `false` when the stored settings could not be read, so a write would overwrite them blind. */
  private settingsWritable = false;

  /** What the server holds, so a value it already has is not written back. */
  private savedSettings: CalendarSettings | null = null;

  constructor() {
    const writes = new Subject<CalendarSettings>();
    writes
      .pipe(
        debounceTime(SETTINGS_DEBOUNCE_MS),
        // In order, never cancelled: a cancelled create can still land and leave two resources.
        concatMap((settings) => this.writeSettings(settings)),
      )
      .subscribe();
    // Completed, not unsubscribed: the debounce flushes a change made just before the page
    // closes, and a write in flight lands.
    this.destroyRef.onDestroy(() => {
      writes.complete();
    });

    effect(() => {
      const settings = this.settings();
      if (!this.ready()) return;
      untracked(() => {
        writeKeptSettings(settings);
        if (this.savedSettings !== null && settingsEqual(this.savedSettings, settings)) return;
        writes.next(settings);
      });
    });

    effect(() => {
      writeKeptPanel(this.keptPanel());
    });

    effect(() => {
      if (!this.loading()) {
        untracked(() => {
          this.refreshRequested.set(false);
        });
      }
    });
  }

  /**
   * Moves to the address at once, so the calendar draws on the first frame. When the reads land,
   * applies the persisted settings, then the default saved view, then the address again. Each one
   * wins over the one before it. The browser's copy stands in for settings that cannot be read.
   *
   * With none of them naming a view, a narrow screen starts in day view. A change the user made
   * before the reads landed wins over all of them.
   */
  async hydrate(
    address: Partial<CalendarPosition>,
    narrow: boolean,
    defaultView: Promise<CalendarViewState | null>,
  ): Promise<void> {
    const kept = this.keptSettings;
    if (narrow && kept === null) this.view.set('day');
    this.applyPosition(address);
    const drawn = untracked(this.viewState);

    const [settings, state] = await Promise.all([this.readSettings(), defaultView]);
    const base = settings ?? kept ?? DEFAULT_SETTINGS;

    if (!viewStatesEqual(untracked(this.viewState), drawn)) {
      // Compared with what is stored, so the user's change is written.
      this.savedSettings = base;
      this.ready.set(true);
      return;
    }

    this.timeScale.set(base.timeScale);
    this.showTime.set(base.showTime);
    this.view.set(settings === null && kept === null && narrow ? 'day' : base.view);
    this.dayColumns.set(base.dayColumns);
    if (state !== null) {
      this.applyViewState(state);
    }
    this.applyPosition(address);
    // What was just applied, not what was stored: a first visit writes nothing until a change.
    this.savedSettings = untracked(this.settings);
    this.ready.set(true);
  }

  /** Applies a saved view: its filters, its calendar view and its settings. The date stays. */
  applyViewState(state: CalendarViewState): void {
    this.filters.set(copyFilters(state.filters));
    this.view.set(state.view);
    this.timeScale.set(state.timeScale);
    this.dayColumns.set(state.dayColumns);
    this.showTime.set(state.showTime);
  }

  /** Moves to a position the address names. Members it does not name are left alone. */
  applyPosition(position: Partial<CalendarPosition>): void {
    if (position.view !== undefined) this.view.set(position.view);
    if (position.anchor !== undefined) this.anchor.set(position.anchor);
    if (position.dayColumns !== undefined) this.dayColumns.set(position.dayColumns);
  }

  setRange(range: CalendarRange): void {
    this.range.set(range);
  }

  /** `overlay` says the panel slides over the calendar, where an open is not persisted. */
  setPanel(panel: CalendarPanel, overlay: boolean): void {
    this.panel.set(panel);
    if (!overlay) {
      this.keptPanel.set(panel);
    }
  }

  clearFilters(): void {
    this.filters.set(emptyFilters());
  }

  refresh(): void {
    this.refreshRequested.set(true);
    this.appointmentsResource.reload();
    this.countsResource.reload();
  }

  /** A reload after a write. The refresh icon stays still, and the held rows keep drawing. */
  reload(): void {
    this.appointmentsResource.reload();
    this.countsResource.reload();
  }

  /**
   * The address that shows `localDate`: the current one when the drawn range holds it, else the
   * same view moved to that day. The address moves the calendar, so nothing here changes it.
   */
  positionFor(localDate: DateValue): CalendarPositionParams {
    return this.shows(localDate)
      ? this.positionParams()
      : positionParams({ ...this.position(), anchor: localDate });
  }

  /** Whether the drawn range holds `localDate`. */
  shows(localDate: DateValue): boolean {
    const range = this.range();
    return range !== null && localDate >= range.start && localDate < range.end;
  }

  /** The day a create starts on: the shown day in day view, else today in the shop. */
  createDate(): DateValue {
    const today = zoneClock(this.timezone()).date;
    return this.view() === 'day' && this.anchor() !== '' ? this.anchor() : today;
  }

  private async readSettings(): Promise<CalendarSettings | null> {
    try {
      const found = await firstValueFrom(this.userResources.findByName(SETTINGS_RESOURCE));
      this.settingsId = found?.id ?? null;
      this.settingsWritable = true;
      return found === null ? null : readSettings(found.value);
    } catch {
      return null;
    }
  }

  private writeSettings(settings: CalendarSettings): Observable<unknown> {
    if (!this.settingsWritable) return EMPTY;
    const id = this.settingsId;
    const write =
      id === null
        ? this.userResources
            .create<CalendarSettings>({ name: SETTINGS_RESOURCE, value: settings })
            .pipe(
              tap((created) => {
                this.settingsId = created.id;
              }),
            )
        : this.userResources.patch<CalendarSettings>(id, { value: settings });
    return write.pipe(
      tap(() => {
        this.savedSettings = settings;
      }),
      // A lost write costs the next visit its settings, never this one its page.
      catchError(() => EMPTY),
    );
  }
}

function nullableQueryEqual(a: AppointmentsQuery | null, b: AppointmentsQuery | null): boolean {
  return a === null || b === null ? a === b : appointmentsQueryEqual(a, b);
}
