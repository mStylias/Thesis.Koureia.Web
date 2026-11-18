import { Service, computed, inject, signal } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import type { AppointmentResponse } from '@api/customer-appointments';
import { Result } from '@synax/client/core';
import { availabilityFromCapacity, type DayAvailability } from '@ui/date-picker';

import { BookingApi } from '../data/booking.api';
import type {
  AvailabilityQuery,
  AvailableSlotViewDto,
  CompanyBookingOptionsResponse,
} from '../data/booking.api.types';
import { BookingDraftStore } from './booking-draft.store';
import { BookingHistory } from './booking-history';
import type {
  BookingDraft,
  BookingRepair,
  BookingSeed,
  BookingStepId,
  BookingTotals,
  ChosenService,
  RescheduleQuote,
} from './booking.types';
import { barbersFor, chosenServices, serviceGroups, totalsFor } from './core/booking-catalog';
import { rescheduleQuote } from './core/reschedule-quote';
import { applyDayCheck, applyTimeCheck, resumeDraft } from './core/resume-draft';
import { bookingWindow, shopToday } from './core/shop-calendar';

/** The steps, in order. The one table both the stepper and "which step is next" read. */
export const BOOKING_STEPS: readonly BookingStepId[] = [
  'shop',
  'services',
  'barber',
  'when',
  'confirm',
];

/**
 * The booking flow: what has been chosen, what is still available, and what each choice does to
 * both.
 *
 * Provided on the booking page, so its lifetime is the page's. It owns the draft and is the only
 * thing that writes it; every component reads derived signals from here and calls an action.
 *
 * **Every action funnels through {@link commit}.** A choice has to do three things at once —
 * update the draft, save it, and push a history snapshot — and a path that skips one of them is
 * a selection that survives a refresh but not a back press, or the reverse. There is one path.
 */
@Service()
export class BookingState {
  private readonly api = inject(BookingApi);
  private readonly drafts = inject(BookingDraftStore);
  private readonly history = inject(BookingHistory);

  private readonly shop = signal<CompanyBookingOptionsResponse | null>(null);
  private readonly current = signal<BookingDraft>(emptyDraft(''));
  private readonly repairsMade = signal<readonly BookingRepair[]>([]);
  private readonly moving = signal<AppointmentResponse | null>(null);

  /** Set while a resumed draft still has a day or a time to check against fresh availability. */
  private dayCheckPending = false;
  private timeCheckPending = false;

  readonly options = this.shop.asReadonly();
  readonly draft = this.current.asReadonly();
  readonly repairs = this.repairsMade.asReadonly();

  /**
   * The appointment being moved, or `null` for an ordinary booking. While it is set the draft is
   * never stored, availability counts its current time as free, and prices follow the move.
   */
  readonly rescheduling = this.moving.asReadonly();

  readonly step = computed(() => this.current().step);
  readonly serviceIds = computed(() => this.current().serviceIds);
  readonly staffMemberId = computed(() => this.current().staffMemberId);
  readonly date = computed(() => this.current().date);
  readonly time = computed(() => this.current().time);
  readonly notes = computed(() => this.current().notes);

  readonly groups = computed(() => {
    const options = this.shop();
    return options === null ? [] : serviceGroups(options);
  });

  readonly chosen = computed<readonly ChosenService[]>(() => {
    const quote = this.quote();
    if (quote !== null) return quote.chosen;
    const options = this.shop();
    if (options === null) return [];
    return chosenServices(options, this.serviceIds(), this.staffMemberId());
  });

  readonly totals = computed<BookingTotals>(() => {
    const quote = this.quote();
    if (quote !== null) return quote.totals;
    const options = this.shop();
    if (options === null) return { durationMinutes: 0, price: 0, exact: true };
    return totalsFor(options, this.serviceIds(), this.staffMemberId());
  });

  /** A move's prices: a service kept with the same barber keeps its booked price. */
  private readonly quote = computed<RescheduleQuote | null>(() => {
    const booked = this.moving();
    const options = this.shop();
    if (booked === null || options === null) return null;

    const startsAtUtc = this.current().startsAtUtc;
    const slot =
      startsAtUtc === null
        ? undefined
        : this.slots().find((candidate) => candidate.startsAtUtc === startsAtUtc);
    return rescheduleQuote(
      options,
      this.serviceIds(),
      this.staffMemberId(),
      booked,
      slot?.staffMemberIds ?? null,
    );
  });

  /** The barbers who can take the whole selection. Empty means the selection is unbookable. */
  readonly barbers = computed(() => {
    const options = this.shop();
    return options === null ? [] : barbersFor(options, this.serviceIds());
  });

  readonly chosenBarber = computed(() => {
    const id = this.staffMemberId();
    return id === null ? null : (this.barbers().find((barber) => barber.id === id) ?? null);
  });

  /**
   * Which steps count as done: every one behind the customer, and no other.
   *
   * **The stepper is sequential.** Done is a run from the start to wherever the customer is
   * standing, never a set with holes in it. A customer who picked a time and then went back to
   * the services would otherwise see `When` ticked and `Barber` not, which is a state the flow
   * has no way to be in.
   *
   * Behind is the same as satisfied: `shop` was chosen to get here, and no step can be left
   * without the value it asks for — a refusal or a repair moves the step back with it.
   */
  readonly completedSteps = computed<readonly BookingStepId[]>(() =>
    BOOKING_STEPS.slice(0, this.stepIndex()),
  );

  private readonly stepIndex = computed(() => BOOKING_STEPS.indexOf(this.step()));

  /** What both availability calls are asked about. `null` until anything can be asked. */
  private readonly availabilityQuery = computed<AvailabilityQuery | null>(() => {
    const options = this.shop();
    const serviceIds = this.serviceIds();
    if (options === null || serviceIds.length === 0) return null;
    return { slug: options.slug, serviceIds, staffMemberId: this.staffMemberId() };
  });

  private readonly daysResource = rxResource({
    params: () => {
      const query = this.availabilityQuery();
      const options = this.shop();
      if (query === null || options === null) return undefined;
      const moving = this.moving()?.id ?? null;
      return { query, moving, ...bookingWindow(options.timezone, options.maxAdvanceDays) };
    },
    stream: ({ params }) =>
      params.moving === null
        ? this.api.days(params.query, params.from, params.to)
        : this.api.rescheduleDays(params.moving, params.query, params.from, params.to),
  });

  private readonly slotsResource = rxResource({
    params: () => {
      const query = this.availabilityQuery();
      const date = this.date();
      if (query === null || date === null) return undefined;
      return { query, date, moving: this.moving()?.id ?? null };
    },
    stream: ({ params }) =>
      params.moving === null
        ? this.api.slots(params.query, params.date)
        : this.api.rescheduleSlots(params.moving, params.query, params.date),
  });

  /** The days the calendar may offer. Empty while loading or after a failure, which disables every day. */
  readonly availableDays = computed<readonly string[]>(() => {
    const result = this.daysResource.value();
    return result?.isSuccess === true ? (result.data?.days ?? []) : [];
  });

  /** The free share of each available day, for the calendar's tints. */
  readonly dayAvailability = computed<DayAvailability>(() => {
    const result = this.daysResource.value();
    return result?.isSuccess === true ? availabilityFromCapacity(result.data?.capacity ?? []) : {};
  });

  readonly slots = computed<readonly AvailableSlotViewDto[]>(() => {
    const result = this.slotsResource.value();
    return result?.isSuccess === true ? (result.data?.slots ?? []) : [];
  });

  readonly daysLoading = computed(() => this.daysResource.isLoading());
  readonly slotsLoading = computed(() => this.slotsResource.isLoading());
  readonly daysFailed = computed(() => failed(this.daysResource.value()));
  readonly slotsFailed = computed(() => failed(this.slotsResource.value()));

  /** Today in the shop's timezone, which is the calendar's floor. */
  readonly today = computed(() => {
    const options = this.shop();
    return options === null ? '' : shopToday(options.timezone);
  });

  /**
   * Seeds the flow from the shop's answer and whatever draft survived.
   *
   * The synchronous repairs run here. The two that need an availability answer — is the day
   * still offered, is the time still free — are deferred to {@link reconcileAvailability},
   * which the page calls as each resource settles.
   */
  start(options: CompanyBookingOptionsResponse): void {
    this.shop.set(options);

    const stored = this.drafts.load(options.slug);
    if (stored === null) {
      const fresh = { ...emptyDraft(options.slug), step: 'services' as const };
      this.current.set(fresh);
      this.repairsMade.set([]);
      this.history.start(fresh.step, (step) => {
        this.restoreStep(step);
      });
      return;
    }

    const resumed = resumeDraft(stored, options, shopToday(options.timezone));
    const seeded: BookingDraft = { ...resumed.draft, step: resumed.step };

    this.dayCheckPending = seeded.date !== null;
    this.timeCheckPending = seeded.time !== null;

    this.current.set(seeded);
    this.repairsMade.set(resumed.repairs);
    this.drafts.save(seeded);
    this.history.start(seeded.step, (step) => {
      this.restoreStep(step);
    });
  }

  /**
   * Seeds the flow to move an appointment: its services, barber and note, with the day and time
   * to choose again. It opens on the date step; the barber and the services stay one step back
   * each. Nothing is read from or written to storage, so a booking in progress survives.
   */
  startReschedule(options: CompanyBookingOptionsResponse, appointment: AppointmentResponse): void {
    this.shop.set(options);
    this.moving.set(appointment);
    this.seed(options, {
      serviceIds: appointment.services.map((service) => service.serviceId),
      staffMemberId: appointment.staffMemberId,
      notes: appointment.notes ?? '',
    });
  }

  /**
   * Seeds an ordinary booking with chosen services and a barber, as "Book again" does. It opens
   * on the date step and replaces any stored draft: the customer asked for this selection.
   *
   * The seed stays in the address, so a refresh or the return from sign-in arrives with it again.
   * A stored draft that already holds the same selection is that same booking further along, so
   * it resumes instead.
   */
  startSeeded(options: CompanyBookingOptionsResponse, seed: BookingSeed): void {
    const stored = this.drafts.load(options.slug);
    if (stored !== null && sameSelection(stored, seed)) {
      this.start(options);
      return;
    }

    this.shop.set(options);
    this.moving.set(null);
    this.seed(options, { ...seed, notes: '' });
  }

  /**
   * Applies the two repairs that needed an answer from the server.
   *
   * Runs **once** per resumed draft. A later refresh of the day list must not clear a date the
   * customer has since picked, which is what a standing rule would do.
   */
  reconcileAvailability(): void {
    const options = this.shop();
    if (options === null) return;

    if (this.dayCheckPending && !this.daysResource.isLoading() && this.availableDays().length > 0) {
      this.dayCheckPending = false;
      const applied = applyDayCheck(
        { draft: this.current(), repairs: this.repairsMade(), step: this.step() },
        this.availableDays(),
      );
      // A dropped day takes its time with it, so there is nothing left to check.
      if (applied.draft.date === null) this.timeCheckPending = false;
      this.adopt(applied.draft, applied.step, applied.repairs);
      return;
    }

    if (this.timeCheckPending && !this.slotsResource.isLoading() && this.date() !== null) {
      this.timeCheckPending = false;
      const applied = applyTimeCheck(
        { draft: this.current(), repairs: this.repairsMade(), step: this.step() },
        this.slots().map((slot) => slot.time),
      );
      this.adopt(applied.draft, applied.step, applied.repairs);
    }
  }

  /** Adds or removes one service. Each toggle is its own choice, so each is its own undo. */
  toggleService(serviceId: string): void {
    const chosenIds = this.serviceIds();
    const next = chosenIds.includes(serviceId)
      ? chosenIds.filter((id) => id !== serviceId)
      : [...chosenIds, serviceId];

    // A barber who cannot perform the new set, and a slot measured for the old one, are both
    // stale the moment the set changes. Dropping them here is what stops the flow offering a
    // time nobody can take.
    const keepsBarber =
      this.staffMemberId() !== null &&
      this.barbersFromOptions(next).some((barber) => barber.id === this.staffMemberId());

    this.commit({
      serviceIds: next,
      staffMemberId: keepsBarber ? this.staffMemberId() : null,
      time: null,
      startsAtUtc: null,
    });
  }

  /** `null` is Anyone, which is a choice like any other. */
  chooseBarber(staffMemberId: string | null): void {
    if (staffMemberId === this.staffMemberId()) return;

    // The barber decides which slots exist, so the chosen time cannot outlive the change.
    this.commit({ staffMemberId, time: null, startsAtUtc: null });
  }

  chooseDate(date: string): void {
    if (date === this.date()) return;

    this.commit({ date, time: null, startsAtUtc: null });
  }

  chooseTime(slot: AvailableSlotViewDto): void {
    this.commit({ time: slot.time, startsAtUtc: slot.startsAtUtc });
  }

  /**
   * The note, saved without a history entry.
   *
   * Typing is not a choice to undo: a back press in the middle of a sentence must take the
   * customer to the previous step, not remove the last character they typed.
   */
  setNotes(notes: string): void {
    const next = { ...this.current(), notes };
    this.current.set(next);
    this.persist(next);
  }

  /** Moves to a step without changing anything. Advancing is itself undoable. */
  goToStep(step: BookingStepId): void {
    if (step === this.step()) return;

    this.commit({ step });
  }

  /** The step after the current one, or `null` at the end. */
  nextStep(): BookingStepId | null {
    return BOOKING_STEPS[this.stepIndex() + 1] ?? null;
  }

  /**
   * The one step behind the customer, or `null` on the first.
   *
   * `shop` is never it: the barbershop was chosen before the stepper appeared, so there is
   * nothing on this page to go back to from `services`. Back from there leaves the page.
   */
  readonly previousStep = computed<BookingStepId | null>(() => {
    // `1` and not `0`: index 0 is `shop`, and index -1 is a step that is not in the table.
    const index = this.stepIndex() - 1;
    return index < 1 ? null : BOOKING_STEPS[index];
  });

  advance(): void {
    const next = this.nextStep();
    if (next !== null) this.goToStep(next);
  }

  /** Whether anything has been chosen, which is what makes "start over" worth offering. */
  readonly hasChoices = computed(() => {
    const draft = this.current();
    return (
      draft.serviceIds.length > 0 ||
      draft.staffMemberId !== null ||
      draft.date !== null ||
      draft.notes !== ''
    );
  });

  /** Throws the selection away and begins again, with no history to walk back into. */
  reset(): void {
    const options = this.shop();
    if (options === null) return;

    this.drafts.clear(options.slug);
    const fresh = { ...emptyDraft(options.slug), step: 'services' as const };
    this.current.set(fresh);
    this.repairsMade.set([]);
    this.dayCheckPending = false;
    this.timeCheckPending = false;
    this.history.start(fresh.step, (step) => {
      this.restoreStep(step);
    });
  }

  /** Clears the stored draft once it has become an appointment. */
  clearStored(): void {
    const options = this.shop();
    if (options !== null && this.moving() === null) this.drafts.clear(options.slug);
  }

  /** Drops the repair notice once the customer has seen it. */
  acknowledgeRepairs(): void {
    if (this.repairsMade().length > 0) this.repairsMade.set([]);
  }

  /** Re-reads the slots for the chosen day, after a submit lost a race for one. */
  refreshSlots(): void {
    this.slotsResource.reload();
  }

  /** Drops one service the server refused, keeping everything else. */
  dropService(serviceId: string): void {
    this.commit({
      serviceIds: this.serviceIds().filter((id) => id !== serviceId),
      time: null,
      startsAtUtc: null,
      step: 'services',
    });
  }

  /** Clears the chosen time, for a slot the server refused. */
  clearTime(): void {
    this.commit({ time: null, startsAtUtc: null, step: 'when' });
  }

  /** Falls back to Anyone, for a barber the server refused. */
  clearBarber(): void {
    this.commit({ staffMemberId: null, time: null, startsAtUtc: null, step: 'barber' });
  }

  /**
   * The one write path: update, persist, record.
   *
   * The step follows the selection unless the caller names one. A choice that invalidates the
   * steps after it leaves the customer where they are; it is the step's own Continue that moves
   * them on.
   */
  private commit(change: Partial<BookingDraft>): void {
    const previous = this.current();
    const next: BookingDraft = { ...previous, ...change };
    this.current.set(next);
    this.persist(next);
    // One entry per section. A choice inside a step is not a thing to undo on its own: back
    // takes the customer to the step before, with what they picked in it still picked.
    if (next.step !== previous.step) this.history.push(next.step);
  }

  /** Answers a back press. Moves the step and records nothing — the entry was just spent. */
  private restoreStep(step: BookingStepId): void {
    const next: BookingDraft = { ...this.current(), step };
    this.current.set(next);
    this.persist(next);
  }

  /** Takes a reconciled draft without recording a choice the customer did not make. */
  private adopt(draft: BookingDraft, step: BookingStepId, repairs: readonly BookingRepair[]): void {
    const next: BookingDraft = { ...draft, step };
    this.current.set(next);
    this.repairsMade.set(repairs);
    this.persist(next);
  }

  /** Starts from a selection, repaired against the shop's current catalog. */
  private seed(
    options: CompanyBookingOptionsResponse,
    selection: BookingSeed & { readonly notes: string },
  ): void {
    const draft: BookingDraft = {
      ...emptyDraft(options.slug),
      serviceIds: selection.serviceIds,
      staffMemberId: selection.staffMemberId,
      notes: selection.notes,
      step: 'when',
    };
    // A service no longer offered or a barber who left is dropped, and the step moves back to it.
    const resumed = resumeDraft(draft, options, shopToday(options.timezone));
    const seeded: BookingDraft = { ...resumed.draft, step: resumed.step };

    this.dayCheckPending = false;
    this.timeCheckPending = false;
    this.current.set(seeded);
    this.repairsMade.set(resumed.repairs);
    this.persist(seeded);
    this.history.start(seeded.step, (step) => {
      this.restoreStep(step);
    });
  }

  /** Stores the draft, except while moving an appointment. */
  private persist(draft: BookingDraft): void {
    if (this.moving() === null) this.drafts.save(draft);
  }

  private barbersFromOptions(serviceIds: readonly string[]) {
    const options = this.shop();
    return options === null ? [] : barbersFor(options, serviceIds);
  }
}

function emptyDraft(slug: string): BookingDraft {
  return {
    slug,
    serviceIds: [],
    staffMemberId: null,
    date: null,
    time: null,
    startsAtUtc: null,
    notes: '',
    step: 'services',
    savedAt: new Date().toISOString(),
  };
}

function sameSelection(draft: BookingDraft, seed: BookingSeed): boolean {
  return (
    draft.staffMemberId === seed.staffMemberId &&
    draft.serviceIds.length === seed.serviceIds.length &&
    draft.serviceIds.every((id, index) => id === seed.serviceIds[index])
  );
}

function failed(result: Result<unknown> | undefined): boolean {
  return result !== undefined && !result.isSuccess;
}
