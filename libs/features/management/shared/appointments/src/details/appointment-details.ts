import {
  Component,
  DestroyRef,
  type AnimationCallbackEvent,
  afterNextRender,
  computed,
  effect,
  inject,
  Injector,
  linkedSignal,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import { rxResource, takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { disabled, hidden, validate } from '@angular/forms/signals';
import {
  ActivatedRoute,
  NavigationCancel,
  NavigationCancellationCode,
  NavigationEnd,
  NavigationError,
  NavigationSkipped,
  Router,
  type Event as RouterEvent,
} from '@angular/router';
import {
  provideTranslocoScope,
  translateObjectSignal,
  TranslocoPipe,
  TranslocoService,
} from '@jsverse/transloco';
import {
  LucideBan,
  LucideCalendarCheck,
  LucideCalendarDays,
  LucideCalendarPlus,
  LucideCheck,
  LucidePencil,
  LucideRotateCcw,
  LucideSave,
  LucideUserX,
  type LucideIconInput,
} from '@lucide/angular';
import { filter, firstValueFrom, map, switchMap, timer } from 'rxjs';
import {
  AppointmentsApi,
  type AppointmentDetailsResponse,
  type AppointmentWarningViewDto,
  type AvailableSlotViewDto,
  type CheckAppointmentRequest,
  type CustomerOptionODataResponse,
  type ListAppointmentDaysRequest,
  type ListAppointmentSlotsRequest,
} from '@api/appointments';
import { StaffAccessStore } from '@auth/data-access';
import {
  addDays,
  addMonths,
  availabilityFromCapacity,
  todayLocal,
  type DayAvailability,
} from '@ui/date-picker';
import {
  injectErrorMessageResolver,
  SYNAX_ERROR_MESSAGES,
  type SynaxErrorMessages,
} from '@synax/client';
import { Result, guid, type HttpError } from '@synax/client/core';
import { injectFormErrors } from '@synax/forms';
import { Banner } from '@ui/banner';
import { Button, ButtonIcon } from '@ui/button';
import { zoneClock } from '@ui/calendar';
import { ConfirmationService } from '@ui/confirmation-dialog';
import { Drawer, DrawerActions, DrawerHeader, DrawerToolbar, type DrawerAction } from '@ui/drawer';
import { ToasterService } from '@ui/toaster';
import { formEditor, type FormFailure } from '@util/forms';

import { isActiveStatus, statusActions } from '../appointment-status';
import type { SettableStatus, StatusAction } from '../appointment-status.types';
import { appointmentsTranslocoScope } from '../appointments.i18n';
import { CancelAppointmentDialog } from '../cancel/cancel-appointment-dialog';
import type { CancelChoice } from '../cancel/cancel-appointment-dialog.types';
import { customersSource } from '../data/customers-source';
import {
  APPOINTMENT_ERROR_CODES,
  APPOINTMENT_ERROR_FIELDS,
  APPOINTMENT_FIELDS,
  emptyAppointmentForm,
} from '../form/appointment.form';
import type { AppointmentFormValue } from '../form/appointment.form.types';
import { AppointmentForm } from '../form/appointment-form';
import { AppointmentFormSkeleton } from '../form/appointment-form-skeleton';
import { endsAfter, fitsAll, freeTimes } from '../form/appointment-draft';
import type { DraftPricing } from '../form/appointment-draft.types';
import {
  createRequest,
  customerEmail,
  customerVisibleChange,
  formFromAppointment,
  formFromPrefill,
  updateRequest,
} from '../form/appointment-requests';
import { APPOINTMENT_PANEL_HOST, NEW_APPOINTMENT } from '../host/appointment-panel-host';
import { formatShortDate } from '../view/appointment-format';
import { AppointmentView } from '../view/appointment-view';
import { AppointmentViewSkeleton } from '../view/appointment-view-skeleton';

const K = 'managementAppointments';

/** The icon of a status change. Restore owns `confirmed`: Confirm draws a calendar check. */
const STATUS_ICONS: Readonly<Record<SettableStatus, LucideIconInput>> = {
  confirmed: LucideRotateCcw,
  completed: LucideCheck,
  no_show: LucideUserX,
};

/** How long the warnings wait for the user to stop changing the time before one check. */
const CHECK_DEBOUNCE_MS = 400;

/** How long the free times wait for the selection to settle before one read. */
const SLOTS_DEBOUNCE_MS = 250;

/** How often "now" moves, for the actions that need the start to have passed. */
const CLOCK_TICK_MS = 30_000;

/**
 * One appointment, or a new one, beside the page that opened it: the calendar now, the
 * appointments grid later. The page provides `APPOINTMENT_PANEL_HOST`, so the drawer imports
 * neither.
 *
 * ```ts
 * children: [{ path: ':appointmentId', component: AppointmentDetails, canDeactivate: [leaveAppointmentDetails] }]
 * ```
 *
 * The panel is the route: `…/new` and `…/<id>` are one route, so opening another tile changes the
 * parameter and the drawer stays open. A tile opens in view mode. Edit is the Edit button, and a
 * reload of an edit lands in view.
 *
 * Unsaved edits are never dropped silently. The drawer's own close asks through `closeGuard`, a
 * navigation asks through {@link canLeave}, and a reload asks through `beforeunload`.
 *
 * A close navigates at once, so the page behind it updates at once. The element stays through the
 * drawer's exit (`animate.leave`), and only over a page that stays. See {@link onLeave}.
 */
@Component({
  selector: 'lib-appointment-details',
  imports: [
    AppointmentForm,
    AppointmentFormSkeleton,
    AppointmentView,
    AppointmentViewSkeleton,
    Banner,
    Button,
    ButtonIcon,
    CancelAppointmentDialog,
    Drawer,
    DrawerHeader,
    DrawerToolbar,
    DrawerActions,
    LucideCalendarDays,
    LucidePencil,
    LucideSave,
    TranslocoPipe,
  ],
  templateUrl: './appointment-details.html',
  styleUrl: './appointment-details.scss',
  providers: [
    provideTranslocoScope(appointmentsTranslocoScope),
    { provide: SYNAX_ERROR_MESSAGES, useFactory: appointmentErrorMessages },
  ],
  host: {
    '(window:beforeunload)': 'onBeforeUnload($event)',
    '(animate.leave)': 'onLeave($event)',
  },
})
export class AppointmentDetails {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly api = inject(AppointmentsApi);
  private readonly access = inject(StaffAccessStore);
  private readonly transloco = inject(TranslocoService);
  private readonly toaster = inject(ToasterService);
  private readonly confirmation = inject(ConfirmationService);
  private readonly errorMessage = injectErrorMessageResolver();
  private readonly formErrors = injectFormErrors();
  protected readonly host = inject(APPOINTMENT_PANEL_HOST);

  private readonly injector = inject(Injector);
  private readonly drawer = viewChild(Drawer);

  /** `false` from the drawer's own close until the navigation it starts settles. */
  protected readonly open = signal(true);

  /** Set by the guard: the drawer's page stays, so the exit plays over it. */
  private exitOverPage = false;

  protected readonly language = toSignal(this.transloco.langChanges$, {
    initialValue: this.transloco.getActiveLang(),
  });

  protected readonly appointmentId = toSignal(
    this.route.paramMap.pipe(map((params) => params.get('appointmentId') ?? NEW_APPOINTMENT)),
    { initialValue: NEW_APPOINTMENT },
  );

  private readonly isNew = computed(() => this.appointmentId() === NEW_APPOINTMENT);

  private readonly appointmentResource = rxResource({
    params: () =>
      this.isNew() ? undefined : { id: this.appointmentId(), language: this.language() },
    stream: ({ params }) => this.api.appointment(params.id, params.language),
  });

  private readonly loaded = computed<AppointmentDetailsResponse | null>(() => {
    const result = this.appointmentResource.hasValue() ? this.appointmentResource.value() : null;
    return result?.isSuccess === true ? result.data : null;
  });

  /**
   * The appointment on screen. It stays while the next one loads, because a new parameter empties
   * the resource, and a body swapped for a loading line and back jumps the drawer to its top.
   */
  protected readonly appointment = linkedSignal<
    { readonly loaded: AppointmentDetailsResponse | null; readonly holding: boolean },
    AppointmentDetailsResponse | null
  >({
    source: () => ({
      loaded: this.isNew() ? null : this.loaded(),
      holding: !this.isNew() && this.appointmentResource.isLoading(),
    }),
    computation: (next, previous) =>
      next.loaded ?? (next.holding ? (previous?.value ?? null) : null),
  });

  /** The appointment on screen is the last one, while the next loads. Its actions wait. */
  protected readonly switching = computed(() => {
    const shown = this.appointment();
    return shown !== null && shown.id !== this.appointmentId();
  });

  protected readonly readError = computed<HttpError | null>(() => {
    if (this.appointmentResource.isLoading()) return null;
    const result = this.appointmentResource.hasValue() ? this.appointmentResource.value() : null;
    return result?.isFailure === true ? result.error : null;
  });

  protected readonly notFound = computed(() => this.readError()?.httpCode === 404);
  protected readonly readErrorText = computed(() => {
    const error = this.readError();
    return error === null ? '' : this.errorMessage(error);
  });

  protected readonly reading = computed(
    () => !this.isNew() && this.appointment() === null && this.appointmentResource.isLoading(),
  );

  /** The appointment "Book again" copies from. */
  private readonly rebookResource = rxResource({
    params: () => {
      const id = this.isNew() ? this.host.prefill().rebookId : undefined;
      return id === undefined ? undefined : { id, language: this.language() };
    },
    stream: ({ params }) => this.api.appointment(params.id, params.language),
  });

  private readonly rebookSource = computed(() => {
    const result = this.rebookResource.hasValue() ? this.rebookResource.value() : null;
    return result?.isSuccess === true ? result.data : null;
  });

  /** Latched on the first create or edit, so leaving edit does not drop the catalog. */
  private readonly catalogWanted = signal(false);

  private readonly catalogResource = rxResource({
    params: () => (this.catalogWanted() ? { language: this.language() } : undefined),
    stream: ({ params }) => this.api.bookingCatalog(params.language),
  });

  protected readonly catalog = computed(() => {
    const result = this.catalogResource.hasValue() ? this.catalogResource.value() : null;
    return result?.isSuccess === true ? result.data : null;
  });

  protected readonly catalogErrorText = computed(() => {
    if (this.catalogResource.isLoading()) return '';
    const result = this.catalogResource.hasValue() ? this.catalogResource.value() : null;
    return result?.isFailure === true ? this.errorMessage(result.error) : '';
  });

  private readonly model = signal<AppointmentFormValue>(emptyAppointmentForm());

  protected readonly editor = formEditor({
    model: this.model,
    fields: APPOINTMENT_FIELDS,
    resetOn: () => this.appointmentId(),
    mode: (id) => (id === NEW_APPOINTMENT ? 'create' : 'view'),
    rules: (path) => {
      validate(path.serviceIds, ({ value }) =>
        value().length === 0
          ? { kind: 'required', message: `${K}.form.errors.servicesRequired` }
          : undefined,
      );
      validate(path.staffMemberId, (field) => {
        const pricing = this.pricing();
        const staffMemberId = field.value();
        return staffMemberId !== '' &&
          pricing !== null &&
          !fitsAll(pricing, staffMemberId, field.valueOf(path.serviceIds))
          ? { kind: 'unfit', message: `${K}.form.errors.barberUnfit` }
          : undefined;
      });
      validate(path.localEndTime, (field) => {
        const start = field.valueOf(path.localStartTime);
        return start !== '' && !endsAfter(start, field.value())
          ? { kind: 'endAfterStart', message: `${K}.form.errors.endAfterStart` }
          : undefined;
      });
    },
    // Hidden fields skip validation, which is what makes a field that is not on screen optional.
    liveRules: (path) => {
      hidden(path.customerId, {
        when: (field) => !this.editor.creating() || field.valueOf(path.customerMode) === 'new',
      });
      hidden(path.newCustomer, {
        when: (field) => !this.editor.creating() || field.valueOf(path.customerMode) === 'existing',
      });
      const noteOnly = { when: () => this.noteOnly() };
      hidden(path.serviceIds, noteOnly);
      hidden(path.staffMemberId, noteOnly);
      hidden(path.localDate, noteOnly);
      hidden(path.localStartTime, noteOnly);
      hidden(path.localEndTime, noteOnly);
      disabled(path.notifyCustomer, { when: () => this.pastDay() });
    },
    action: () => this.write(),
  });

  /** A terminal appointment edits its internal note and nothing else. */
  protected readonly noteOnly = computed(() => {
    const appointment = this.appointment();
    return (
      this.editor.mode() === 'edit' && appointment !== null && !isActiveStatus(appointment.status)
    );
  });

  protected readonly pricing = computed<DraftPricing | null>(() => {
    const catalog = this.catalog();
    if (catalog === null) return null;
    const appointment = this.editor.creating() ? null : this.appointment();
    return {
      catalog,
      booked:
        appointment === null
          ? null
          : {
              staffMemberId: appointment.staffMemberId,
              services: appointment.services,
              startPassed: this.started(),
            },
    };
  });

  protected readonly customers = customersSource(this.api);

  /** The customer the search picked, for their email. */
  protected readonly pickedCustomer = signal<CustomerOptionODataResponse | null>(null);

  /**
   * The customer a create holds without a pick: a prefill or "Book again". Its own computed, so
   * a change elsewhere in the form never starts the read again.
   */
  private readonly unpickedCustomerId = computed<string | undefined>(() => {
    if (!this.editor.creating()) return undefined;
    const { customerMode, customerId } = this.model();
    const id = String(customerId);
    if (customerMode !== 'existing' || id === '' || this.pickedCustomer()?.id === id) {
      return undefined;
    }
    return id;
  });

  /** That customer's row, read by id. */
  private readonly customerRowResource = rxResource({
    params: () => this.unpickedCustomerId(),
    stream: ({ params }) =>
      this.api.customers({ filter: { id: guid(params) }, top: 1 }).pipe(
        map((result) => {
          const row = result.isSuccess ? result.data?.items[0] : undefined;
          return row === undefined ? null : (row as unknown as CustomerOptionODataResponse);
        }),
      ),
  });

  /** The existing customer a create books for, for the form's hints and preferred barber. */
  protected readonly customerRow = computed<CustomerOptionODataResponse | null>(() => {
    if (!this.editor.creating()) return null;
    const { customerMode, customerId } = this.model();
    const id = String(customerId);
    if (customerMode !== 'existing' || id === '') return null;
    const picked = this.pickedCustomer();
    if (picked?.id === id) return picked;
    const read = this.customerRowResource.hasValue() ? this.customerRowResource.value() : null;
    return read?.id === id ? read : null;
  });

  private readonly email = computed(() => {
    const value = this.model();
    if (this.editor.creating()) return customerEmail(value, this.customerRow()?.email);
    return this.appointment()?.customerEmail ?? null;
  });

  /** A date before today in shop time. Nobody is emailed about a day that has passed. */
  protected readonly pastDay = computed(() => {
    const date = this.model().localDate;
    return date !== '' && date < zoneClock(this.host.timezone(), this.now()).date;
  });

  /** Whether "Notify the customer" is offered, per the spec's §6 and §7. */
  protected readonly notifyOffered = computed(() => {
    if (this.email() === null || this.noteOnly()) return false;
    if (this.editor.creating()) return true;
    const appointment = this.appointment();
    return appointment !== null && customerVisibleChange(this.model(), appointment);
  });

  private readonly checkRequest = computed<CheckAppointmentRequest | null>(
    () => {
      if (!this.editor.editing() || this.noteOnly()) return null;
      const value = this.model();
      // Without services, only a typed end gives the time a length.
      const timed =
        value.serviceIds.length > 0 || (value.endOverridden && value.localEndTime !== '');
      if (
        value.staffMemberId === '' ||
        !timed ||
        value.localDate === '' ||
        value.localStartTime === ''
      ) {
        return null;
      }
      const customerId =
        this.editor.creating() && value.customerMode === 'existing' && value.customerId !== ''
          ? String(value.customerId)
          : (this.appointment()?.customerId ?? null);
      return {
        appointmentId: this.editor.creating() ? null : this.appointmentId(),
        customerId: this.editor.creating() && value.customerMode === 'new' ? null : customerId,
        staffMemberId: value.staffMemberId,
        serviceIds: value.serviceIds,
        localDate: value.localDate,
        localStartTime: value.localStartTime,
        localEndTime: value.endOverridden ? value.localEndTime : null,
      };
    },
    { equal: (a, b) => JSON.stringify(a) === JSON.stringify(b) },
  );

  /** A new request cancels the pending one, so the timer is the debounce. */
  private readonly checkResource = rxResource({
    params: () => this.checkRequest() ?? undefined,
    stream: ({ params }) => timer(CHECK_DEBOUNCE_MS).pipe(switchMap(() => this.api.check(params))),
  });

  /** A failed check shows nothing: the save still runs, and the server still refuses overlaps. */
  protected readonly warnings = computed<readonly AppointmentWarningViewDto[]>(() => {
    if (this.checkRequest() === null) return [];
    const result = this.checkResource.hasValue() ? this.checkResource.value() : null;
    return result?.isSuccess === true ? (result.data?.warnings ?? []) : [];
  });

  /** The free-time grid's query. Only a create shows the grid, and only once it has a date. */
  private readonly slotsRequest = computed<ListAppointmentSlotsRequest | null>(
    () => {
      if (!this.editor.creating()) return null;
      const value = this.model();
      if (value.manualTime || value.localDate === '') return null;
      return {
        localDate: value.localDate,
        serviceIds: value.serviceIds,
        // Every barber: the form narrows the grid to the chosen one and reads who is free.
        staffMemberId: null,
        customerId:
          value.customerMode === 'existing' && value.customerId !== ''
            ? String(value.customerId)
            : null,
      };
    },
    { equal: (a, b) => JSON.stringify(a) === JSON.stringify(b) },
  );

  private readonly slotsResource = rxResource({
    params: () => this.slotsRequest() ?? undefined,
    stream: ({ params }) => timer(SLOTS_DEBOUNCE_MS).pipe(switchMap(() => this.api.slots(params))),
  });

  protected readonly slotsLoading = computed(
    () => this.slotsRequest() !== null && this.slotsResource.isLoading(),
  );

  protected readonly slotsFailed = computed(() => {
    if (this.slotsRequest() === null || this.slotsResource.isLoading()) return false;
    const result = this.slotsResource.hasValue() ? this.slotsResource.value() : null;
    return result?.isFailure === true;
  });

  /**
   * The day's free times, or `null` before the first read. The last day stays while the next
   * one loads, so a change to the services does not blank the grid.
   */
  protected readonly slots = linkedSignal<
    { readonly loaded: readonly AvailableSlotViewDto[] | null; readonly holding: boolean },
    readonly AvailableSlotViewDto[] | null
  >({
    source: () => {
      const result = this.slotsResource.hasValue() ? this.slotsResource.value() : null;
      return {
        loaded:
          this.slotsRequest() !== null && !this.slotsResource.isLoading() && result?.isSuccess
            ? (result.data?.slots ?? [])
            : null,
        holding: this.slotsLoading(),
      };
    },
    computation: (next, previous) =>
      next.loaded ?? (next.holding ? (previous?.value ?? null) : null),
  });

  /** The month the date picker shows. A new date moves it, and paging sets it. */
  protected readonly shownMonth = linkedSignal(() =>
    (this.model().localDate || todayLocal()).slice(0, 7),
  );

  /** The query for the date picker's tints. It waits for a service, because the room depends on it. */
  private readonly daysRequest = computed<ListAppointmentDaysRequest | null>(
    () => {
      if (this.editor.viewing()) return null;
      const value = this.model();
      if (value.serviceIds.length === 0) return null;
      const month = this.shownMonth();
      const customerId = this.editor.creating()
        ? value.customerMode === 'existing' && value.customerId !== ''
          ? String(value.customerId)
          : null
        : (this.appointment()?.customerId ?? null);
      return {
        from: `${month}-01`,
        to: addDays(`${addMonths(month, 1)}-01`, -1),
        serviceIds: value.serviceIds,
        staffMemberId: value.staffMemberId || null,
        customerId,
        appointmentId: this.editor.creating() ? null : this.appointmentId(),
      };
    },
    { equal: (a, b) => JSON.stringify(a) === JSON.stringify(b) },
  );

  private readonly daysResource = rxResource({
    params: () => this.daysRequest() ?? undefined,
    stream: ({ params }) => timer(SLOTS_DEBOUNCE_MS).pipe(switchMap(() => this.api.days(params))),
  });

  /**
   * The free share of each day in the shown month. The last answer stays while the next one
   * loads, so a change to the services does not flash the tints. A failure shows none.
   */
  protected readonly dayAvailability = linkedSignal<DayAvailability | null, DayAvailability>({
    source: () => {
      if (this.daysRequest() === null) return {};
      if (this.daysResource.isLoading()) return null;
      const result = this.daysResource.hasValue() ? this.daysResource.value() : null;
      return result?.isSuccess === true
        ? availabilityFromCapacity(result.data?.capacity ?? [])
        : {};
    },
    computation: (next, previous) => next ?? previous?.value ?? {},
  });

  /** A start the address supplied, until the first read of free times confirms or rejects it. */
  private readonly prefilledStart = signal<string | null>(null);

  protected readonly canCreate = computed(() => this.access.has('appointments:create'));
  protected readonly canUpdate = computed(() => this.access.has('appointments:update'));
  protected readonly canCancel = computed(() => this.access.has('appointments:cancel'));

  private readonly now = signal(new Date());

  /** Whether the start has passed in shop time. */
  private readonly started = computed(() => {
    const appointment = this.appointment();
    if (appointment === null) return false;
    const clock = zoneClock(this.host.timezone(), this.now());
    return (
      `${appointment.localDate} ${appointment.localStartTime}` <= `${clock.date} ${clock.time}`
    );
  });

  protected readonly statusActions = computed<readonly StatusAction[]>(() => {
    const appointment = this.appointment();
    if (appointment === null || !this.canUpdate()) return [];
    return statusActions(appointment.status, this.started());
  });

  protected readonly cancellable = computed(() => {
    const appointment = this.appointment();
    return appointment !== null && this.canCancel() && isActiveStatus(appointment.status);
  });

  /** Reads the scope's copy as a signal, so the toolbar follows a language change. */
  private readonly actionLabels = translateObjectSignal('actions');

  /**
   * The toolbar's group: Book again, then the status changes and Cancel. The drawer folds the
   * last ones into ⋮ first. Restore is always a ⋮ row. Edit, Cancel and Save are the end slot.
   */
  protected readonly toolbarActions = computed<readonly DrawerAction[]>(() => {
    if (this.editor.editing() || this.appointment() === null) return [];
    const labels = this.actionLabels() as Record<string, string>;
    const label = (key: string): string => labels[key.slice(`${K}.actions.`.length)] ?? '';
    const disabled = this.acting();
    const actions: DrawerAction[] = [];
    if (this.canCreate()) {
      actions.push({
        id: 'bookAgain',
        label: label(`${K}.actions.bookAgain`),
        icon: LucideCalendarPlus,
        severity: 'primary',
        variant: 'filled',
        disabled,
        run: () => {
          this.bookAgain();
        },
      });
    }
    for (const action of this.statusActions()) {
      actions.push({
        id: action.label,
        label: label(action.label),
        icon: action.place === 'button' ? LucideCalendarCheck : STATUS_ICONS[action.to],
        iconOnly: action.place === 'icon',
        menuOnly: action.place === 'menu',
        disabled,
        run: () => {
          void this.changeStatus(action);
        },
      });
    }
    if (this.cancellable()) {
      actions.push({
        id: 'cancelAppointment',
        label: label(`${K}.actions.cancelAppointment`),
        icon: LucideBan,
        iconOnly: true,
        disabled,
        run: () => {
          this.cancelOpen.set(true);
        },
      });
    }
    return actions;
  });

  /** A status change or a cancel in flight. The toolbar stays put until it answers. */
  protected readonly acting = signal(false);

  protected readonly cancelOpen = signal(false);

  /** A refusal that means the appointment moved under the user. The toolbar offers Reload. */
  protected readonly stale = signal(false);

  /** Who and when, under the title of a saved appointment: "Μαρία Παπαδοπούλου • Παρ 11 Σεπ 2026". */
  protected readonly description = computed(() => {
    const appointment = this.appointment();
    if (this.editor.creating() || appointment === null) return null;
    return `${appointment.customerDisplayName} • ${formatShortDate(appointment.localDate, this.language())}`;
  });

  /** The projected heading names the drawer, because the drawer's own title is not used. */
  protected readonly labelledBy = computed(() =>
    this.description() === null
      ? 'appointment-details-title'
      : 'appointment-details-title appointment-details-description',
  );

  /** The title key of the mode. */
  protected readonly heading = computed(() => {
    const mode = this.editor.mode();
    return mode === 'create'
      ? `${K}.panel.new`
      : mode === 'edit'
        ? `${K}.panel.edit`
        : `${K}.panel.appointment`;
  });

  /** The staff member the page knows for the open appointment, for its swatch. */
  protected readonly staffMember = computed(() => {
    const id = this.appointment()?.staffMemberId;
    return this.host.staff().find((member) => member.id === id) ?? null;
  });

  /** Where the history's "View all" goes, from the page. */
  protected readonly customerLink = computed(() => {
    const customerId = this.appointment()?.customerId;
    return customerId === undefined ? null : this.host.customerAppointments(customerId);
  });

  /** The drawer's ×, Escape and Cancel ask the same question a navigation does. */
  protected readonly closeGuard = (): Promise<boolean> => this.canLeave();

  constructor() {
    const selected = this.host.selected;
    effect(() => {
      const id = this.appointmentId();
      untracked(() => {
        selected?.set(id === NEW_APPOINTMENT ? null : id);
      });
    });

    // The form follows the record while nobody edits it. A create reads its prefill once, when
    // the address becomes `new`, so moving the calendar behind it never resets what was typed.
    effect(() => {
      const appointment = this.appointment();
      untracked(() => {
        if (!this.isNew() && appointment !== null && !this.editor.editing()) {
          this.editor.reset(formFromAppointment(appointment));
        }
      });
    });
    // A new prefill has passed the discard guard, so it replaces the form. The copy "Book again"
    // reads arrives later and fills the form only if the user has not started on it.
    effect(() => {
      if (!this.isNew()) return;
      const prefill = this.host.prefill();
      const source = this.rebookSource();
      untracked(() => {
        if (this.editor.form().dirty()) return;
        this.editor.reset(formFromPrefill(prefill, source));
        this.prefilledStart.set(prefill.localStartTime ?? null);
        this.pickedCustomer.set(null);
        this.catalogWanted.set(true);
      });
    });

    // A start picked on the calendar is deliberate. When it is not free, the pickers keep it.
    effect(() => {
      const start = this.prefilledStart();
      if (start === null) return;
      const value = this.model();
      const slots = this.slots();
      const settled = !this.slotsLoading() && (slots !== null || this.slotsFailed());
      if (!value.manualTime && value.localStartTime === start && !settled) return;
      untracked(() => {
        this.prefilledStart.set(null);
        if (value.manualTime || value.localStartTime !== start) return;
        if (slots === null || !freeTimes(slots, value.staffMemberId).includes(start)) {
          this.editor.form.manualTime().value.set(true);
        }
      });
    });

    // A past day unchecks "Notify the customer", and a later day gives the user's choice back.
    let heldNotify = false;
    effect(() => {
      const past = this.pastDay();
      const notify = this.model().notifyCustomer;
      untracked(() => {
        if (past && notify) {
          heldNotify = true;
          this.editor.form.notifyCustomer().value.set(false);
        } else if (!past && heldNotify) {
          heldNotify = false;
          this.editor.form.notifyCustomer().value.set(true);
        }
      });
    });

    // Another record opens at the top, in the same frame it is drawn.
    let shownId: string | null = null;
    effect(() => {
      const id = this.appointment()?.id ?? null;
      if (id === shownId) return;
      const switched = shownId !== null && id !== null;
      shownId = id;
      if (!switched) return;
      afterNextRender(
        () => {
          this.drawer()?.scrollToTop();
        },
        { injector: this.injector },
      );
    });

    // An inactive barber in a prefill is dropped, not reported.
    effect(() => {
      const catalog = this.catalog();
      if (catalog === null || !this.editor.creating()) return;
      untracked(() => {
        const staffMemberId = this.model().staffMemberId;
        if (
          staffMemberId !== '' &&
          !catalog.staffMembers.some((member) => member.id === staffMemberId)
        ) {
          this.editor.form.staffMemberId().value.set('');
        }
      });
    });

    // A close whose navigation did not happen opens the drawer again.
    this.router.events.pipe(filter(settled), takeUntilDestroyed()).subscribe(() => {
      if (!this.open()) this.open.set(true);
    });

    const clock = setInterval(() => {
      this.now.set(new Date());
    }, CLOCK_TICK_MS);
    inject(DestroyRef).onDestroy(() => {
      clearInterval(clock);
      selected?.set(null);
    });
  }

  /**
   * Whether the drawer may go: yes unless an edit holds changes, and then only when the user
   * discards them. A discard resets the form, so the navigation it leads to asks nothing again.
   */
  async canLeave(): Promise<boolean> {
    if (!this.editor.editing() || !this.editor.form().dirty()) return true;
    const answer = await this.confirmation.open({
      title: this.transloco.translate(`${K}.discard.title`),
      message: this.transloco.translate(`${K}.discard.message`),
      confirmLabel: this.transloco.translate(`${K}.discard.discard`),
      cancelLabel: this.transloco.translate(`${K}.discard.keep`),
      severity: 'warning',
    });
    if (answer !== 'confirmed') return false;
    this.editor.reset();
    return true;
  }

  /**
   * Called by the guard before the route goes. Over a page that stays, the exit plays. When the
   * page goes too, it would only hold the next page back.
   */
  prepareLeave(overPage: boolean): void {
    this.exitOverPage = overPage;
  }

  /** Holds the element through the drawer's exit after the router has destroyed the view. */
  protected onLeave(event: AnimationCallbackEvent): void {
    const drawer = this.drawer();
    if (!this.exitOverPage || drawer === undefined) {
      event.animationComplete();
      return;
    }
    void drawer.exit().then(() => {
      event.animationComplete();
    });
  }

  protected onBeforeUnload(event: BeforeUnloadEvent): void {
    if (this.editor.editing() && this.editor.form().dirty()) {
      event.preventDefault();
    }
  }

  protected edit(): void {
    const appointment = this.appointment();
    if (appointment === null || !this.canUpdate()) return;
    this.stale.set(false);
    this.editor.reset(formFromAppointment(appointment));
    this.catalogWanted.set(true);
    this.editor.mode.set('edit');
  }

  /** An edit goes back to view. A create has nothing behind it, so it closes. */
  protected async cancelEdit(): Promise<void> {
    if (!(await this.canLeave())) return;
    if (this.editor.creating()) {
      this.host.close();
      return;
    }
    const appointment = this.appointment();
    this.editor.reset(appointment === null ? undefined : formFromAppointment(appointment));
    this.editor.mode.set('view');
  }

  protected save(): void {
    void this.editor.commit();
  }

  protected reload(): void {
    this.stale.set(false);
    this.appointmentResource.reload();
  }

  protected reloadCatalog(): void {
    this.catalogResource.reload();
  }

  protected bookAgain(): void {
    const appointment = this.appointment();
    if (appointment !== null) this.host.create({ rebookId: appointment.id });
  }

  protected openOther(id: string, localDate: string): void {
    this.host.open(id, localDate);
  }

  protected async changeStatus(action: StatusAction): Promise<void> {
    const appointment = this.appointment();
    if (appointment === null || this.acting()) return;
    this.acting.set(true);
    const result = await firstValueFrom(
      this.api.changeStatus(appointment.id, { status: action.to }, this.language()),
    );
    this.acting.set(false);
    const restored = action.to === 'confirmed' && appointment.status !== 'pending';
    this.written(result, restored ? 'restored' : action.to);
  }

  protected async cancelAppointment(choice: CancelChoice): Promise<void> {
    const appointment = this.appointment();
    if (appointment === null || this.acting()) return;
    this.acting.set(true);
    const result = await firstValueFrom(
      this.api.cancel(
        appointment.id,
        {
          reason: choice.reason,
          notifyCustomer: choice.notifyCustomer && appointment.customerEmail !== null,
          includeReason: choice.includeReason,
        },
        this.language(),
      ),
    );
    this.acting.set(false);
    if (this.written(result, 'cancelled')) this.cancelOpen.set(false);
  }

  /** The drawer's own close: the ×, Escape. The page moves at once, and the exit plays over it. */
  protected onVisibleChange(visible: boolean): void {
    this.open.set(visible);
    if (!visible) this.host.close();
  }

  /** Shows a status change or a cancel. `true` when it went through. */
  private written(result: Result<AppointmentDetailsResponse>, toast: string): boolean {
    if (!result.isSuccess) {
      this.toaster.error(this.errorMessage(result.error));
      if (result.error.errorCode === 'APPOINTMENT_INVALID_TRANSITION') this.reload();
      return false;
    }
    const saved = result.data;
    if (saved === null) {
      // A write that answered with no body: read what it wrote.
      this.appointmentResource.reload();
    } else {
      this.appointmentResource.set(result);
      this.host.written(saved, false);
    }
    this.toaster.success(this.transloco.translate(`${K}.toast.${toast}`));
    return true;
  }

  /**
   * The save. A create moves the address to the new id, which resets the editor to a view of it.
   * The form is reset first, so the navigation does not ask to discard what was just saved.
   */
  private async write(): Promise<FormFailure | undefined> {
    const value = this.model();
    const creating = this.editor.creating();
    const appointment = this.appointment();
    const canNotify = this.email() !== null && !this.pastDay();

    const result = await firstValueFrom(
      creating
        ? this.api.create(createRequest(value, canNotify), this.language())
        : this.api.update(
            this.appointmentId(),
            updateRequest(value, appointment ?? missing(), this.noteOnly(), canNotify),
            this.language(),
          ),
    );

    if (!result.isSuccess) {
      if (result.error.errorCode === 'APPOINTMENT_NOT_EDITABLE') this.stale.set(true);
      // Another request gave the email to a customer at the same moment. A retry books for them.
      if (result.error.errorCode === 'CUSTOMER_EMAIL_TAKEN') {
        this.toaster.error(this.errorMessage(result.error));
        return undefined;
      }
      return this.formErrors(result.error, APPOINTMENT_ERROR_FIELDS);
    }

    this.toaster.success(
      this.transloco.translate(`${K}.toast.${creating ? 'created' : 'updated'}`),
    );
    const saved = result.data;
    if (saved === null) {
      // The API answers every write with the appointment. Without it there is nothing to show.
      this.editor.reset();
      if (creating) this.host.close();
      else this.reload();
      return undefined;
    }
    this.editor.reset(formFromAppointment(saved));
    if (!creating) {
      this.appointmentResource.set(result);
      this.editor.mode.set('view');
    }
    this.host.written(saved, creating);
    return undefined;
  }
}

/** The end of a navigation. A superseded one is not: the navigation after it decides. */
function settled(event: RouterEvent): boolean {
  return (
    event instanceof NavigationEnd ||
    event instanceof NavigationSkipped ||
    event instanceof NavigationError ||
    (event instanceof NavigationCancel &&
      event.code !== NavigationCancellationCode.SupersededByNewNavigation)
  );
}

/** An edit is only offered once the appointment is read, so this never runs. */
function missing(): never {
  throw new Error('appointment panel: an edit without an appointment');
}

/** The drawer's own copy for the codes it knows, over whatever the app registered. */
function appointmentErrorMessages(): SynaxErrorMessages {
  const transloco = inject(TranslocoService);
  const parent = inject(SYNAX_ERROR_MESSAGES, { optional: true, skipSelf: true }) ?? {};
  const codes = Object.fromEntries(
    APPOINTMENT_ERROR_CODES.map((code) => [code, () => transloco.translate(`${K}.errors.${code}`)]),
  );
  return { ...parent, codes: { ...parent.codes, ...codes } };
}
