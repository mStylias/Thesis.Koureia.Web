import { Component, DestroyRef, effect, inject, untracked, viewChild } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterOutlet } from '@angular/router';
import { provideTranslocoScope, TranslocoPipe } from '@jsverse/transloco';
import { injectErrorMessageResolver } from '@synax/client';
import { Button } from '@ui/button';
import {
  Calendar,
  CalendarFilterActionsSlot,
  CalendarFiltersSlot,
  CalendarViewsSlot,
  type CalendarEvent,
  type CalendarPanel,
  type CalendarSlot,
} from '@ui/calendar';
import { SavedViews } from '@ui/saved-views';
import {
  SAVED_VIEWS_STORAGE,
  SavedViewsController,
  savedViewsResourceKey,
} from '@ui/saved-views/core';
import { ToasterService } from '@ui/toaster';
import { StaffAccessStore } from '@auth/data-access';
import { APPOINTMENT_PANEL_HOST } from '@features/management-shared-appointments';

import { calendarTranslocoScope } from '../calendar.i18n';
import { VIEWS_KEY, isCalendarViewState, viewStatesEqual } from '../calendar-settings';
import { CalendarStore } from '../calendar.store';
import { readPosition } from '../calendar-url';
import type { CalendarPositionParams, CalendarViewState } from '../calendar.types';
import { CalendarFiltersPanel } from '../filters/calendar-filters-panel';
import { calendarPanelHost } from './calendar-panel-host';

/** Below the `md` breakpoint, where a first visit starts in day view. */
const NARROW_QUERY = '(max-width: 767.98px)';

const POSITION_PARAMS = ['view', 'date', 'columns'] as const;

/**
 * The shop's appointment book at `/management/calendar`.
 *
 * The address carries the position (`?view=week&date=2026-09-21`, and `&columns=barbers` in
 * per-barber day view), so a reload, the back button and a shared link land on the same screen.
 * The address wins over the persisted last view.
 *
 * The calendar is drawn at once, at the address, with the settings this browser last showed. The
 * persisted view and the default saved view land on top when they arrive. They switch the view
 * only when they changed on another device.
 */
@Component({
  selector: 'lib-calendar-page',
  imports: [
    Button,
    Calendar,
    CalendarFilterActionsSlot,
    CalendarFiltersPanel,
    CalendarFiltersSlot,
    CalendarViewsSlot,
    RouterOutlet,
    SavedViews,
    TranslocoPipe,
  ],
  templateUrl: './calendar-page.html',
  styleUrl: './calendar-page.scss',
  providers: [
    provideTranslocoScope(calendarTranslocoScope),
    // Not on the route: a route injector outlives the page, and a store kept from the last
    // visit draws its old view before the saved view is applied.
    CalendarStore,
    // The appointment drawer, a child route in this page's outlet, reads the calendar through it.
    { provide: APPOINTMENT_PANEL_HOST, useFactory: calendarPanelHost },
  ],
})
export class CalendarPage {
  protected readonly store = inject(CalendarStore);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly toaster = inject(ToasterService);
  private readonly access = inject(StaffAccessStore);
  private readonly panelHost = inject(APPOINTMENT_PANEL_HOST);
  private readonly errorMessage = injectErrorMessageResolver();
  private readonly viewsStorage = inject(SAVED_VIEWS_STORAGE, { optional: true });
  private readonly calendar = viewChild(Calendar);

  private destroyed = false;

  /** `false` until the first write, which replaces the entry instead of adding one. */
  private addressWritten = false;

  /** Saved views: the filters, the calendar view and the settings, under one name. */
  protected readonly views = new SavedViewsController<CalendarViewState>({
    key: () => savedViewsResourceKey(VIEWS_KEY),
    storage: () => this.viewsStorage,
    state: () => this.store.viewState(),
    apply: (state) => {
      this.store.applyViewState(state);
    },
    isDestroyed: () => this.destroyed,
    isState: isCalendarViewState,
    statesEqual: viewStatesEqual,
  });

  constructor() {
    inject(DestroyRef).onDestroy(() => {
      this.destroyed = true;
    });

    void this.store.hydrate(
      readPosition(this.route.snapshot.queryParamMap),
      typeof matchMedia === 'function' && matchMedia(NARROW_QUERY).matches,
      this.views.load(savedViewsResourceKey(VIEWS_KEY)),
    );

    effect(() => {
      const params = this.store.positionParams();
      if (!this.store.ready()) return;
      untracked(() => {
        this.writeAddress(params);
      });
    });

    // Back and forward change the address, and the address moves the calendar.
    this.route.queryParamMap.pipe(takeUntilDestroyed()).subscribe((params) => {
      if (this.store.ready()) {
        this.store.applyPosition(readPosition(params));
      }
    });

    effect(() => {
      const error = this.store.loadError();
      if (error === null) return;
      untracked(() => {
        this.toaster.error(this.errorMessage(error));
      });
    });
  }

  /** An open made while the panel overlays the calendar is shown but not persisted. */
  protected onPanel(panel: CalendarPanel): void {
    this.store.setPanel(panel, this.calendar()?.panelOverlay() ?? false);
  }

  protected openAppointment(event: CalendarEvent): void {
    this.panelHost.open(event.id, event.date);
  }

  /**
   * The create button sends no slot. A double click sends the day, the time and the column.
   * Without `appointments:create` both do nothing.
   */
  protected createAppointment(slot: CalendarSlot | null): void {
    if (!this.access.has('appointments:create')) return;
    this.panelHost.create({
      ...(slot === null ? {} : { localDate: slot.date }),
      ...(slot?.time === undefined ? {} : { localStartTime: slot.time }),
      ...(slot?.resourceId === undefined ? {} : { staffMemberId: slot.resourceId }),
    });
  }

  /**
   * Puts the position in the address and keeps the rest of it: an open panel's path and its
   * slot parameters survive a step of the calendar behind it.
   */
  private writeAddress(params: CalendarPositionParams): void {
    const current = this.route.snapshot.queryParamMap;
    if (POSITION_PARAMS.every((name) => current.get(name) === (params[name] ?? null))) {
      this.addressWritten = true;
      return;
    }

    const tree = this.router.parseUrl(this.router.url);
    const kept = Object.fromEntries(
      Object.entries(tree.queryParams).filter(
        ([name]) => !(POSITION_PARAMS as readonly string[]).includes(name),
      ),
    );
    tree.queryParams = { ...kept, ...params };
    void this.router.navigateByUrl(tree, { replaceUrl: !this.addressWritten });
    this.addressWritten = true;
  }
}
