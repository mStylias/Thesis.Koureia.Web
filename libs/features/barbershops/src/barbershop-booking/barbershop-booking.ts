import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  afterNextRender,
  computed,
  effect,
  inject,
  Injector,
  linkedSignal,
  signal,
} from '@angular/core';
import { rxResource, takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { BreakpointObserver } from '@angular/cdk/layout';
import { Location, NgTemplateOutlet } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import {
  TranslocoPipe,
  TranslocoService,
  provideTranslocoScope,
  translateObjectSignal,
  translateSignal,
} from '@jsverse/transloco';
import { PendingActionStore, SessionStore } from '@auth/data-access';
import {
  CustomerAppointmentErrorCodes,
  CustomerAppointmentsApi,
  readPriceChange,
  type AppointmentPriceChange,
} from '@api/customer-appointments';
import { UserProfileApi } from '@api/users';
import type { HttpError } from '@synax/client/core';
import { LucideArrowLeft, LucidePhone, LucideRotateCcw, LucideShieldCheck } from '@lucide/angular';
import { Banner } from '@ui/banner';
import { BottomSheet } from '@ui/bottom-sheet';
import { Button, ButtonIcon } from '@ui/button';
import { ConfirmationService } from '@ui/confirmation-dialog';
import { Stepper, type StepperStep } from '@ui/stepper';
import { ToasterService } from '@ui/toaster';
import { ActiveLanguage, withLanguagePrefix } from '@util/language';
import { firstValueFrom } from 'rxjs';

import { barbershopsTranslocoScope } from '../barbershops.i18n';
import { ReplayOnChange } from '../replay-on-change';
import { AppointmentErrorCodes, BookingApi } from '../data/booking.api';
import type { CompanyBookingOptionsResponse } from '../data/booking.api.types';
import { BOOKING_STEPS, BookingState } from './booking-state';
import { BookingDraftStore } from './booking-draft.store';
import { BookingHistory } from './booking-history';
import { BookingReschedule } from './booking-reschedule/booking-reschedule';
import { BookingSummary } from './booking-summary/booking-summary';
import type { BookingGate, BookingPage, BookingStepId, ReschedulePage } from './booking.types';
import {
  READ_BOOKING_PAGE,
  READ_RESCHEDULE_PAGE,
  readBookingSeed,
} from './barbershop-booking.resolvers';
import {
  formatDuration,
  formatPrice,
  formatShopDate,
  formatTotals,
  joinServiceNames,
} from './core/format-booking';
import { BookingBarber } from './steps/booking-barber/booking-barber';
import { BookingConfirm } from './steps/booking-confirm/booking-confirm';
import { BookingConfirmFields } from './steps/booking-confirm/booking-confirm-fields';
import { BookingDatetime } from './steps/booking-datetime/booking-datetime';
import { BookingServices } from './steps/booking-services/booking-services';

/**
 * Where the footer bar replaces the sheet.
 *
 * `1024px` is `lg` in `libs/shared/styles/src/abstracts/_scale.scss`, repeated here because a
 * Sass map is not readable at runtime and `BreakpointObserver` resolves in TypeScript. The two
 * are kept equal by hand — see `MAP_COLUMN_QUERY`, which does the same for the shop list.
 */
const BAR_QUERY = '(min-width: 1024px)';

/**
 * The booking flow, at `/barbershops/{slug}/booking`.
 *
 * It owns the layout — the stepper, the step body, and the selection summary — and delegates
 * every decision about the selection to {@link BookingState}.
 *
 * **The summary is on screen at every size.** A footer bar across the page from `lg` up, a
 * bottom sheet below it. One `lib-booking-summary` renders in both, so there is nothing that
 * can disagree about what a booking looks like.
 *
 * The URL never changes while the customer chooses. Going back is handled by
 * {@link BookingHistory}, which pushes one state entry per step at the same address — so the
 * back gesture, the back button and the stepper all move by exactly one section.
 */
@Component({
  selector: 'lib-barbershop-booking',
  imports: [
    Banner,
    BookingBarber,
    BookingConfirm,
    BookingConfirmFields,
    BookingDatetime,
    BookingReschedule,
    BookingServices,
    BookingSummary,
    BottomSheet,
    Button,
    ButtonIcon,
    LucideArrowLeft,
    LucidePhone,
    LucideRotateCcw,
    NgTemplateOutlet,
    ReplayOnChange,
    RouterLink,
    Stepper,
    TranslocoPipe,
  ],
  providers: [
    provideTranslocoScope(barbershopsTranslocoScope),
    BookingState,
    BookingDraftStore,
    BookingHistory,
  ],
  templateUrl: './barbershop-booking.html',
  styleUrl: './barbershop-booking.scss',
  host: {
    // The pinned sheet holds a whole step, so the page lets it grow past its usual ceiling.
    '[attr.data-pinned]': 'confirmInSheet() ? "" : null',
  },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BarbershopBooking {
  private readonly api = inject(BookingApi);
  private readonly profiles = inject(UserProfileApi);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly language = inject(ActiveLanguage);
  private readonly transloco = inject(TranslocoService);
  private readonly confirmation = inject(ConfirmationService);
  private readonly injector = inject(Injector);
  private readonly pendingActions = inject(PendingActionStore);
  private readonly session = inject(SessionStore);
  private readonly location = inject(Location);
  private readonly appointments = inject(CustomerAppointmentsApi);
  private readonly toaster = inject(ToasterService);

  protected readonly state = inject(BookingState);

  protected readonly shieldIcon = LucideShieldCheck;

  protected readonly page: BookingPage = READ_BOOKING_PAGE(this.route.snapshot);

  /** The appointment this page moves, from `?reschedule={id}`. `none` for a booking. */
  protected readonly reschedule: ReschedulePage = READ_RESCHEDULE_PAGE(this.route.snapshot);

  /** The move was refused because the appointment can no longer change online. */
  protected readonly moveClosed = signal(false);

  /**
   * The total the server named when the confirmed one went stale. The next confirm sends it, and
   * any change to the selection drops it, because the server prices that selection again.
   */
  protected readonly newTotal = linkedSignal<string, AppointmentPriceChange | null>({
    source: () => {
      const draft = this.state.draft();
      return `${draft.serviceIds.join(',')}|${draft.staffMemberId ?? ''}|${draft.startsAtUtc ?? ''}`;
    },
    computation: () => null,
  });

  /** Where "See the appointment" goes from a move that cannot go ahead. */
  protected readonly appointmentLink = computed(() => {
    const id =
      this.reschedule.status === 'found'
        ? this.reschedule.appointment.id
        : this.reschedule.status === 'unavailable'
          ? this.reschedule.appointmentId
          : '';
    return withLanguagePrefix(`/account/appointments/${id}`, this.language.value());
  });

  /** "You are changing your appointment: …", over every step of a move. */
  protected readonly movingNotice = computed(() => {
    const booked = this.state.rescheduling();
    if (booked === null) return null;
    return {
      date: formatShopDate(booked.localDate, this.language.value(), true),
      time: booked.localTime,
      barber: booked.staffDisplayName,
    };
  });

  protected readonly sheetExpanded = signal(false);

  /**
   * Whether the layout is wide enough for the footer bar instead of the sheet.
   *
   * It starts `false` and is answered in the browser: `matchMedia` has no answer during a
   * server render, and a guess baked into the HTML would be wrong for half the visitors.
   * `afterNextRender` puts the answer after hydration, so the first client render still
   * matches what the server sent.
   */
  private readonly wide = signal(false);

  protected readonly submitting = signal(false);
  protected readonly failure = signal<string | null>(null);

  /** The optional number the confirm step collects. Saved with the booking, never before it. */
  protected readonly phone = signal('');

  private readonly stepLabels = translateObjectSignal('booking.steps');

  /**
   * Whether this person can book this shop online. Asked once they are signed in: an anonymous
   * visitor keeps the usual flow, and the check runs again after the sign-in.
   */
  private readonly access = rxResource({
    params: () =>
      this.page.status === 'found' && this.session.isSignedIn()
        ? this.page.options.slug
        : undefined,
    stream: ({ params }) => this.api.bookingAccess(params),
  });

  /** The submit was refused because the shop blocked the person while the page was open. */
  private readonly refusedByShop = signal(false);

  /**
   * The shop does not take this person's online bookings: the notice replaces the steps. It
   * carries the shop's phone, and never the word "blocked" or the reason.
   */
  protected readonly shopRefusal = computed<{ readonly phone: string } | null>(() => {
    const result = this.access.hasValue() ? this.access.value() : null;
    const answer = result?.isSuccess === true ? result.data : null;
    if (!this.refusedByShop() && answer?.canBookOnline !== false) return null;
    return { phone: answer?.shopPhone ?? '' };
  });

  /** `tel:` wants the number without spaces. */
  protected phoneHref(phone: string): string {
    return `tel:${phone.replace(/\s+/g, '')}`;
  }

  constructor() {
    if (this.page.status === 'found') this.startFlow(this.page.options);

    const breakpoints = inject(BreakpointObserver);
    const destroyRef = inject(DestroyRef);

    afterNextRender(() => {
      breakpoints
        .observe(BAR_QUERY)
        .pipe(takeUntilDestroyed(destroyRef))
        .subscribe((state) => {
          this.wide.set(state.matches);
        });
    });

    // The pinned sheet is the confirm screen, so it opens with it and closes with it. Reading
    // only `confirmInSheet` is what keeps this from fighting the customer in between: it runs
    // when the screen changes, never when they collapse the sheet themselves.
    effect(() => {
      this.sheetExpanded.set(this.confirmInSheet());
    });

    // The two repairs that needed an answer from the server. `reconcileAvailability` runs once
    // per resumed draft and refuses to fire again, so a later refresh of the day list cannot
    // clear a date the customer has since picked.
    effect(() => {
      this.state.availableDays();
      this.state.slots();
      this.state.reconcileAvailability();
    });
  }

  /**
   * Whether the confirm step lives in the sheet rather than in the page.
   *
   * Below `lg` it does, and then the step has no body at all: the sheet is pinned open and
   * carries the fields, the notice and the amount.
   */
  protected readonly confirmInSheet = computed(
    () => !this.wide() && this.state.step() === 'confirm',
  );

  protected readonly steps = computed<readonly StepperStep[]>(() => {
    // Empty until the scope loads, so every label falls back to its own id.
    const labels = this.stepLabels() as Record<string, string | undefined>;
    const done = new Set(this.state.completedSteps());
    const back = this.state.previousStep();

    return BOOKING_STEPS.map((id) => ({
      id,
      label: labels[id] ?? id,
      // Only the step directly behind the customer is reachable. The rest read as done and
      // are inert — `shop` because it was chosen before the stepper appeared, the others
      // because the flow is walked one section at a time, forward and back.
      locked: done.has(id) && id !== back,
    }));
  });

  /**
   * Which way the arriving step comes in from.
   *
   * Forward and back are the same swap to the DOM, so the direction has to be carried: a step
   * that always entered from one side would say the customer had advanced when they had gone
   * back. Empty until the step has moved once, which keeps the first paint still.
   *
   * Entrances only. A leave holds the outgoing step in flow while the arriving one is laid out
   * under it, and the page then collapses in one jump when the exit ends — the same trap
   * `barbershops-list.scss` records for the results grid.
   */
  protected readonly stepEnter = linkedSignal<BookingStepId, string>({
    source: () => this.state.step(),
    computation: (step, previous) => {
      if (previous === undefined) return '';
      const from = BOOKING_STEPS.indexOf(previous.source);
      return BOOKING_STEPS.indexOf(step) < from ? 'step-enter step-enter--back' : 'step-enter';
    },
  });

  protected readonly barberName = computed(() => this.state.chosenBarber()?.displayName ?? null);

  /** `3 υπηρεσίες · 115′` — what the choices add up to, for the sheet's bar. */
  private readonly countParams = computed(() => ({
    count: String(this.state.chosen().length),
    duration: formatDuration(this.state.totals().durationMinutes),
  }));

  private readonly countOneLabel = translateSignal('booking.summary.countOne', this.countParams);
  private readonly countManyLabel = translateSignal('booking.summary.countMany', this.countParams);

  /**
   * The line under the shop's name in the sheet's bar, split so it truncates in the middle.
   *
   * `head` is what the choices add up to and gives up its characters to the ellipsis; `tail`
   * is the day and time and is pinned. A plain end ellipsis would eat exactly the choice the
   * customer just made and is looking down to confirm.
   *
   * The day drops once the sheet is open, because the rows below it say the same thing.
   */
  protected readonly choices = computed<{ head: string; tail: string }>(() => {
    const services = this.state.chosen();
    if (this.state.options() === null || services.length === 0) return { head: '', tail: '' };

    const count = services.length === 1 ? this.countOneLabel() : this.countManyLabel();

    const date = this.state.date();
    if (date === null || this.sheetExpanded()) return { head: '', tail: count };

    const time = this.state.time();
    const day = formatShopDate(date, this.language.value());
    return { head: `${count} • `, tail: time === null ? day : `${day}, ${time}` };
  });

  /** What the choices come to, for the row at the end of the sheet's panel. */
  protected readonly sheetTotal = computed(() => {
    const options = this.state.options();
    if (options === null) return '';
    return formatTotals(this.state.totals(), options.currency, this.language.value());
  });

  /** One sentence covering the whole repair, never a stack of notices. */
  protected readonly repairNotice = computed(() => {
    const repairs = this.state.repairs();
    if (repairs.length === 0) return null;

    // The earliest repair is the one that explains the rest: a dropped service is why the
    // barber and the slot went with it.
    const key = `barbershops.booking.repairs.${repairs[0]}`;
    const message = this.transloco.translate(key);
    return message === key ? null : message;
  });

  /**
   * Which of the three paths the customer is on, for the confirm step's button.
   *
   * It lives here rather than in the step because the button does: the actions row is the
   * page's, so the flow advances from the same place at every step.
   *
   * `deciding` is its own state, not a guess at `anonymous`: showing a sign-in button to
   * someone who is already signed in, for the moment it takes to find out, is worse than
   * showing nothing.
   */
  protected readonly gate = computed<BookingGate>(() => {
    if (!this.session.isReady()) return 'deciding';
    if (!this.session.isSignedIn()) return 'anonymous';
    return this.session.isEmailVerified() ? 'ready' : 'unverified';
  });

  protected readonly canAdvance = computed(() => {
    switch (this.state.step()) {
      case 'services':
        return this.state.serviceIds().length > 0;
      case 'barber':
        return this.state.barbers().length > 0;
      case 'when':
        return this.state.draft().startsAtUtc !== null;
      default:
        return false;
    }
  });

  protected onStepSelected(step: string): void {
    this.state.goToStep(step as BookingStepId);
    this.sheetExpanded.set(false);
  }

  /**
   * The back control, in the sheet's bar and beside the step's title.
   *
   * It is the browser's back button and nothing else: one step back, or off the page from the
   * first one. A control that meant something different from the gesture beside it would be
   * two ways back that disagree.
   */
  protected goBack(): void {
    this.location.back();
  }

  /**
   * What the confirm step's action means, which is whatever the gate says.
   *
   * The bar's button switches its own handler by branching in the template; this one arrives
   * as a single press, so the branch is here instead. One method, so the two cannot diverge.
   */
  protected commit(): void {
    switch (this.gate()) {
      case 'anonymous':
        this.signIn();
        return;
      case 'unverified':
        void this.verify();
        return;
      case 'ready':
        void (this.state.rescheduling() === null ? this.book() : this.move());
        return;
      default:
        return;
    }
  }

  protected advance(): void {
    this.failure.set(null);
    this.state.advance();
  }

  /** Throws the selection away, behind a confirmation, because nothing else undoes it. */
  protected async startOver(): Promise<void> {
    const result = await this.confirmation.open(
      {
        title: this.transloco.translate('barbershops.booking.reset.title'),
        message: this.transloco.translate('barbershops.booking.reset.message'),
        // Destructive, and the only severity whose foreground is white: `warning` puts
        // near-black on amber, which is what keeps that pairing readable.
        severity: 'error',
        confirmLabel: this.transloco.translate('barbershops.booking.reset.confirm'),
        cancelLabel: this.transloco.translate('barbershops.booking.reset.cancel'),
      },
      // The dialog is built at the root. This carries the page's customer copy to it.
      this.injector,
    );
    if (result !== 'confirmed') return;

    this.failure.set(null);
    this.sheetExpanded.set(false);
    this.state.reset();
  }

  protected signIn(): void {
    this.recordPendingAction();
    this.session.signIn(this.router.url);
  }

  protected async verify(): Promise<void> {
    this.recordPendingAction();
    await this.router.navigate([withLanguagePrefix('/verify-email', this.language.value())], {
      queryParams: { returnUrl: this.router.url },
    });
  }

  protected async book(): Promise<void> {
    const options = this.state.options();
    const draft = this.state.draft();
    if (options === null || draft.startsAtUtc === null || this.submitting()) return;

    this.submitting.set(true);
    this.failure.set(null);

    const result = await firstValueFrom(
      this.api.create({
        companyId: options.companyId,
        serviceIds: draft.serviceIds,
        staffMemberId: draft.staffMemberId,
        startsAtUtc: draft.startsAtUtc,
        notes: draft.notes.trim() === '' ? null : draft.notes.trim(),
        languageCode: this.language.value(),
      }),
    );
    this.submitting.set(false);

    if (!result.isSuccess || result.data === null) {
      this.handleFailure(result.isSuccess ? null : result.error);
      return;
    }

    this.savePhone();

    // The draft has become an appointment, and the stack that could walk back into it goes with
    // it. `replaceUrl` is what stops the back button returning to a booking already made.
    this.state.clearStored();
    this.pendingActions.clear();
    await this.router.navigate(
      [
        withLanguagePrefix(
          `/barbershops/${options.slug}/booking/${result.data.id}`,
          this.language.value(),
        ),
      ],
      { replaceUrl: true },
    );
  }

  /**
   * Moves the appointment to the chosen time, with the services and barber chosen.
   *
   * It sends the total the customer saw. A different total refuses the move and changes nothing,
   * and the refusal names the new total, which the next press confirms.
   */
  protected async move(): Promise<void> {
    const booked = this.state.rescheduling();
    const draft = this.state.draft();
    if (booked === null || draft.startsAtUtc === null || this.submitting()) return;

    this.submitting.set(true);
    this.failure.set(null);

    const notes = draft.notes.trim();
    const result = await firstValueFrom(
      this.appointments.reschedule(
        booked.id,
        {
          serviceIds: draft.serviceIds,
          staffMemberId: draft.staffMemberId,
          startsAtUtc: draft.startsAtUtc,
          notes: notes === '' ? null : notes,
          expectedTotalPrice: this.newTotal()?.totalPrice ?? this.state.totals().price,
        },
        this.language.value(),
      ),
    );
    this.submitting.set(false);

    if (!result.isSuccess || result.data === null) {
      this.handleMoveFailure(result.isSuccess ? null : result.error);
      return;
    }

    this.savePhone();
    this.toaster.success(this.transloco.translate('barbershops.booking.reschedule.done'));
    // `replaceUrl`, so back from the appointment does not walk into a move already made.
    await this.router.navigate([this.appointmentLink()], { replaceUrl: true });
  }

  /**
   * Starts the flow the address asks for: a move, a booking seeded by "Book again", or a
   * booking resumed from its stored draft.
   */
  private startFlow(options: CompanyBookingOptionsResponse): void {
    if (this.reschedule.status === 'found') {
      this.state.startReschedule(options, this.reschedule.appointment);
      return;
    }
    if (this.reschedule.status === 'unavailable') return;

    const seed = readBookingSeed(this.route.snapshot);
    if (seed === null) {
      this.state.start(options);
    } else {
      this.state.startSeeded(options, seed);
    }
  }

  /** A refused move: a new total to confirm, a closed window, or a booking refusal. */
  private handleMoveFailure(error: HttpError | null): void {
    const change = error === null ? null : readPriceChange(error);
    if (change !== null) {
      this.newTotal.set(change);
      this.failure.set(
        this.transloco.translate('barbershops.booking.reschedule.priceChanged', {
          total: formatPrice(change.totalPrice, change.currency, this.language.value()),
        }),
      );
      return;
    }

    switch (error?.errorCode) {
      case CustomerAppointmentErrorCodes.ChangeWindowClosed:
      case CustomerAppointmentErrorCodes.NotEditable:
      case CustomerAppointmentErrorCodes.NotFound:
        this.moveClosed.set(true);
        return;
      default:
        this.handleFailure(error);
    }
  }

  /**
   * Writes the optional number to the profile, after the appointment exists and without waiting.
   *
   * It is a convenience, so nothing about it may delay the success screen or fail the booking.
   * A refusal is swallowed: the appointment is made either way, and there is no second thing
   * to ask the customer to do about it.
   */
  private savePhone(): void {
    const value = this.phone().trim();
    if (value === '') return;

    this.profiles.updatePhoneNumber(value).subscribe({ error: () => undefined });
  }

  /**
   * Turns a refusal into the step that can answer it.
   *
   * Every branch keeps the draft. A failed submit is not a lost booking, and the customer must
   * land somewhere they can act rather than on a dead end.
   */
  private handleFailure(error: HttpError | null): void {
    const code = error?.errorCode ?? '';
    const say = (key: string): void => {
      this.failure.set(this.transloco.translate(`barbershops.booking.errors.${key}`));
    };

    switch (code) {
      case AppointmentErrorCodes.SlotTaken:
      case AppointmentErrorCodes.SlotUnavailable:
      case AppointmentErrorCodes.LeadTime:
      case AppointmentErrorCodes.TooFarAhead:
        this.state.clearTime();
        this.state.refreshSlots();
        say(code === AppointmentErrorCodes.SlotTaken ? 'slotTaken' : 'slotUnavailable');
        return;
      case AppointmentErrorCodes.StaffUnavailable:
        this.state.clearBarber();
        say('staffUnavailable');
        return;
      case AppointmentErrorCodes.ServiceUnavailable:
        // The server does not name which one, so the customer re-picks from a fresh list.
        this.state.goToStep('services');
        say('serviceUnavailable');
        return;
      case AppointmentErrorCodes.OverlapsExisting:
        say('overlapsExisting');
        return;
      case AppointmentErrorCodes.EmailNotVerified:
        void this.verify();
        return;
      case AppointmentErrorCodes.CustomerBanned:
        say('customerBanned');
        return;
      case AppointmentErrorCodes.CustomerBlockedByShop:
        // The same notice as up front. A fresh read brings the shop's phone with it.
        this.refusedByShop.set(true);
        this.access.reload();
        return;
      default:
        say('generic');
    }
  }

  /**
   * Leaves the auth screens something to say about why the person is there.
   *
   * Written **before** the navigation, never after and never on `beforeunload`: a sign-in is a
   * full-page redirect, and an unload handler is not a place to depend on.
   */
  private recordPendingAction(): void {
    const options = this.state.options();
    if (options === null) return;

    const rows: { label: string; value: string }[] = [
      {
        label: this.transloco.translate('barbershops.booking.summary.services'),
        value: joinServiceNames(this.state.chosen()),
      },
      {
        label: this.transloco.translate('barbershops.booking.summary.barber'),
        value: this.barberName() ?? this.transloco.translate('barbershops.booking.barber.anyone'),
      },
    ];

    const date = this.state.date();
    const time = this.state.time();
    if (date !== null && time !== null) {
      rows.push({
        label: this.transloco.translate('barbershops.booking.summary.when'),
        value: `${formatShopDate(date, this.language.value(), true)}, ${time}`,
      });
    }

    this.pendingActions.record({
      kind: 'booking',
      title: this.transloco.translate('barbershops.booking.pendingTitle'),
      rows: rows.filter((row) => row.value !== ''),
    });
  }
}
