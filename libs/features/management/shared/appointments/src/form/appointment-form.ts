import { Component, computed, effect, inject, input, output, untracked } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { FormField } from '@angular/forms/signals';
import { TranslocoPipe } from '@jsverse/transloco';
import { LucideInfo, LucideUserPlus, LucideUserSearch } from '@lucide/angular';
import { catchError, map, of, switchMap, timer } from 'rxjs';
import {
  AppointmentsApi,
  type AppointmentDetailsResponse,
  type AppointmentWarningViewDto,
  type AvailableSlotViewDto,
  type CustomerOptionODataResponse,
} from '@api/appointments';
import {
  Autocomplete,
  AutocompleteOptionTemplate,
  type AutocompleteSelection,
} from '@ui/autocomplete';
import { Banner } from '@ui/banner';
import { Button, ButtonIcon } from '@ui/button';
import { Checkbox } from '@ui/checkbox';
import type { DataSource } from '@ui/data-source';
import { DatePicker, type DayAvailability } from '@ui/date-picker';
import { Field, FieldControl, FieldEditor, FormErrors, FormHost } from '@ui/form-field';
import { InputText } from '@ui/input-text';
import { MultiSelect } from '@ui/multi-select';
import { PhoneInput } from '@ui/phone-input';
import { Select, SelectOptionTemplate, type SelectOption } from '@ui/select';
import { Textarea } from '@ui/textarea';
import { TimePicker } from '@ui/time-picker';
import { Tooltip } from '@ui/tooltip';
import type { FormEditor } from '@util/forms';

import { formatMoney } from '../view/appointment-format';
import {
  draftLength,
  draftLines,
  draftTotal,
  fitsAll,
  freeTimes,
  nextEnd,
  offering,
  serviceOptions,
} from './appointment-draft';
import type { DraftPricing, DraftServiceOption, DraftTimes } from './appointment-draft.types';
import { customerSearchTerm } from '../data/customers-source';
import { NOTE_MAX_LENGTH } from './appointment.form';
import type { PanelStaffMember } from '../host/appointment-panel-host.types';
import type { AppointmentFormValue } from './appointment.form.types';
import type { DuplicateCustomer, DuplicateLookup } from './appointment-form.types';

/** How long the walk-in duplicate lookup waits for typing to stop. */
const DUPLICATE_DEBOUNCE_MS = 500;

/** "Contains" can match more than the one customer, so a few rows are read. */
const DUPLICATE_PAGE = 5;

/** A whole address, the only thing the account lookup answers for. */
const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

/**
 * The fields of a create or an edit, over the panel's {@link FormEditor}. The panel owns the
 * commit, so this component holds no save of its own.
 *
 * The end follows the start and the services until the user types one. From then on it is an
 * override: a new start moves it by the same amount, and Reset hands it back to the services.
 *
 * A create picks its start from the day's free times, and the end follows the services. "Set the
 * time manually" brings back the pickers, which is how staff book a time that is not free.
 */
@Component({
  selector: 'lib-appointment-form',
  imports: [
    Autocomplete,
    AutocompleteOptionTemplate,
    Banner,
    Button,
    ButtonIcon,
    Checkbox,
    DatePicker,
    Field,
    FieldControl,
    FieldEditor,
    FormErrors,
    FormField,
    FormHost,
    InputText,
    LucideInfo,
    LucideUserPlus,
    LucideUserSearch,
    MultiSelect,
    PhoneInput,
    Select,
    SelectOptionTemplate,
    Textarea,
    TimePicker,
    Tooltip,
    TranslocoPipe,
  ],
  templateUrl: './appointment-form.html',
  styleUrl: './appointment-form.scss',
})
export class AppointmentForm {
  private readonly api = inject(AppointmentsApi);

  readonly editor = input.required<FormEditor<AppointmentFormValue>>();
  readonly pricing = input.required<DraftPricing>();
  /** The barbers' names and swatches. The catalog carries only their offerings. */
  readonly staff = input<readonly PanelStaffMember[]>([]);
  /** The appointment an edit changes. `null` for a create. */
  readonly appointment = input<AppointmentDetailsResponse | null>(null);
  /** A terminal appointment: the internal note is the one field. */
  readonly noteOnly = input(false);
  readonly customers = input.required<DataSource<CustomerOptionODataResponse>>();
  /** The existing customer a create books for: picked, prefilled or copied. `null` otherwise. */
  readonly customer = input<CustomerOptionODataResponse | null>(null);
  readonly warnings = input<readonly AppointmentWarningViewDto[]>([]);
  readonly notifyOffered = input(false);
  readonly language = input.required<string>();
  /** The day's free times for a create, or `null` before they load. */
  readonly slots = input<readonly AvailableSlotViewDto[] | null>(null);
  readonly slotsLoading = input(false);
  readonly slotsFailed = input(false);
  /** The free share of each day, for the date picker's tints. */
  readonly dayAvailability = input<DayAvailability>({});
  /** The date is before today, so the grid is empty and nobody is emailed. */
  readonly pastDay = input(false);

  /** The customer the search picked, or `null` when it was cleared. */
  readonly customerPicked = output<CustomerOptionODataResponse | null>();
  /** The `YYYY-MM` the date picker moved to. */
  readonly monthShown = output<string>();

  protected readonly noteMaxLength = NOTE_MAX_LENGTH;

  protected readonly form = computed(() => this.editor().form);
  private readonly value = computed(() => this.form()().value());

  protected readonly creating = computed(() => this.editor().creating());
  protected readonly walkIn = computed(() => this.value().customerMode === 'new');
  protected readonly interval = computed(() => this.pricing().catalog.slotIntervalMinutes);

  protected readonly slotMode = computed(() => this.creating() && !this.value().manualTime);

  /**
   * The barber's free times, plus the chosen start when a later change made it busy. The start
   * stays picked, and the warnings name what it collides with.
   */
  protected readonly gridTimes = computed<readonly string[] | null>(() => {
    const slots = this.slots();
    if (slots === null) return null;
    const { staffMemberId, localStartTime } = this.value();
    const times = freeTimes(slots, staffMemberId);
    return localStartTime === '' || times.includes(localStartTime)
      ? times
      : [...times, localStartTime].sort();
  });

  /** Who is free at the chosen start, or `null` when the grid does not decide it. */
  private readonly freeAtStart = computed<ReadonlySet<string> | null>(() => {
    const slots = this.slots();
    const start = this.value().localStartTime;
    if (!this.slotMode() || slots === null || start === '') return null;
    const slot = slots.find((candidate) => candidate.time === start);
    return slot === undefined ? null : new Set(slot.staffMemberIds);
  });

  private readonly options = computed(() =>
    serviceOptions(this.pricing().catalog, this.appointment()?.services),
  );

  private readonly categories = computed(
    () => new Map(this.options().map((option) => [option.id, option.category])),
  );

  protected readonly serviceOptions = computed<readonly SelectOption<string, DraftServiceOption>[]>(
    () => {
      const { staffMemberId, serviceIds } = this.value();
      const pricing = this.pricing();
      return this.options().map((option) => ({
        value: option.id,
        label: option.name,
        item: option,
        disabled:
          staffMemberId !== '' &&
          !serviceIds.includes(option.id) &&
          offering(pricing.catalog, staffMemberId, option.id) === undefined,
      }));
    },
  );

  protected readonly barberOptions = computed<readonly SelectOption<string>[]>(() => {
    const pricing = this.pricing();
    const { serviceIds } = this.value();
    const free = this.freeAtStart();
    const names = new Map(this.staff().map((member) => [member.id, member.displayName]));
    const options: SelectOption<string>[] = pricing.catalog.staffMembers.map((member) => ({
      value: member.id,
      label: names.get(member.id) ?? '',
      disabled: !fitsAll(pricing, member.id, serviceIds) || (free !== null && !free.has(member.id)),
    }));
    // An inactive barber stays on the appointment until changed, and cannot be picked again.
    const booked = this.appointment();
    if (booked !== null && !options.some((option) => option.value === booked.staffMemberId)) {
      options.push({ value: booked.staffMemberId, label: booked.staffDisplayName, disabled: true });
    }
    return options;
  });

  protected readonly summary = computed(() => {
    const { staffMemberId, serviceIds, localStartTime, localEndTime } = this.value();
    if (staffMemberId === '' || serviceIds.length === 0) return null;
    const lines = draftLines(this.pricing(), staffMemberId, serviceIds);
    return {
      total: formatMoney(draftTotal(lines), this.pricing().catalog.currency, this.language()),
      count: draftLength(lines),
      // The grid shows no end, so the summary states the span.
      timed: this.slotMode() && localStartTime !== '' && localEndTime !== '',
      start: localStartTime,
      end: localEndTime,
    };
  });

  protected readonly overridden = computed(() => this.value().endOverridden);

  /** A walk-in whose email or phone already belongs to a customer of the shop. */
  private readonly duplicateLookup = computed<DuplicateLookup | undefined>(
    () => {
      const value = this.value();
      if (!this.creating() || value.customerMode !== 'new') return undefined;
      const email = value.newCustomer.email.trim();
      if (EMAIL.test(email)) return { kind: 'email', value: email };
      const digits = value.newCustomer.phoneNumber.replace(/\D/g, '');
      return digits.length >= 8 ? { kind: 'phone', value: digits } : undefined;
    },
    { equal: (a, b) => a?.kind === b?.kind && a?.value === b?.value },
  );

  /** "Contains" is the endpoint's match, so the exact one is picked here. */
  private readonly duplicateResource = rxResource({
    params: () => this.duplicateLookup(),
    stream: ({ params }) =>
      timer(DUPLICATE_DEBOUNCE_MS).pipe(
        switchMap(() =>
          this.api.customers({ search: customerSearchTerm(params.value), top: DUPLICATE_PAGE }),
        ),
        map((result): DuplicateCustomer | null => {
          const rows = result.isSuccess ? (result.data?.items ?? []) : [];
          const customer = rows
            .filter((row) => typeof row['id'] === 'string')
            .map((row) => row as unknown as CustomerOptionODataResponse)
            .find((row) => sameContact(params, row));
          return customer === undefined ? null : { kind: params.kind, customer };
        }),
      ),
  });

  protected readonly duplicate = computed(() =>
    this.duplicateLookup() !== undefined && this.duplicateResource.hasValue()
      ? this.duplicateResource.value()
      : null,
  );

  /** A walk-in email to ask the account lookup about. */
  private readonly accountEmail = computed(() => {
    const value = this.value();
    if (!this.creating() || value.customerMode !== 'new') return undefined;
    const email = value.newCustomer.email.trim();
    return EMAIL.test(email) ? email : undefined;
  });

  /**
   * Whether an account holds the walk-in's email. The API books for that account. A refusal,
   * the rate limit included, hides the hint and never blocks the save.
   */
  private readonly accountResource = rxResource({
    params: () => this.accountEmail(),
    stream: ({ params }) =>
      timer(DUPLICATE_DEBOUNCE_MS).pipe(
        switchMap(() => this.api.findCustomerAccount({ email: params })),
        map((result) => result.isSuccess && result.data?.hasAccount === true),
        catchError(() => of(false)),
      ),
  });

  /** The shop-customer hint outranks this one when both match. */
  protected readonly accountHint = computed(
    () =>
      this.accountEmail() !== undefined &&
      this.duplicate() === null &&
      this.accountResource.hasValue() &&
      this.accountResource.value(),
  );

  protected readonly customerName = (customer: CustomerOptionODataResponse): string =>
    customer.displayName;

  /** The barber a customer prefers, by name, for the search's options. */
  protected preferredName(customer: CustomerOptionODataResponse): string | null {
    const id = customer.preferredStaffMemberId;
    if (id === null) return null;
    return this.staff().find((member) => member.id === id)?.displayName ?? null;
  }

  /** The category a service option names, read by id: the option template's item is untyped. */
  protected categoryOf(serviceId: unknown): string | null {
    return typeof serviceId === 'string' ? (this.categories().get(serviceId) ?? null) : null;
  }

  /** Phone and email tell apart two customers with the same name. */
  protected customerContact(customer: CustomerOptionODataResponse): string {
    return [customer.phoneNumber, customer.email].filter((part) => !!part).join(' • ');
  }

  constructor() {
    // A picked customer brings their preferred barber into an empty barber field, once per
    // customer. A barber from a slot or chosen by hand is never replaced.
    let preselectedFor: string | null = null;
    effect(() => {
      const customer = this.customer();
      if (!this.creating() || customer === null || customer.id === preselectedFor) return;
      untracked(() => {
        preselectedFor = customer.id;
        const barber = this.preferredBarber(customer);
        if (barber !== null) this.form().staffMemberId().value.set(barber);
      });
    });

    // The grid has no end picker, so its end always follows the services.
    effect(() => {
      if (this.slotMode() && this.value().endOverridden) {
        untracked(() => {
          this.form().endOverridden().value.set(false);
        });
      }
    });

    // The end follows the start and the length until it is overridden.
    let previous: DraftTimes | null = null;
    effect(() => {
      const value = this.value();
      const pricing = this.pricing();
      if (this.noteOnly()) return;
      const next: DraftTimes = {
        start: value.localStartTime,
        end: value.localEndTime,
        overridden: value.endOverridden,
      };
      const length = draftLength(draftLines(pricing, value.staffMemberId, value.serviceIds));
      const end = nextEnd(previous ?? next, next, length);
      previous = { ...next, end };
      if (end !== value.localEndTime) {
        untracked(() => {
          this.form().localEndTime().value.set(end);
        });
      }
    });
  }

  /**
   * The customer's preferred barber, when the form can take them: the field is empty, and the
   * barber is active, bookable, offers every service chosen so far and is free at the start.
   */
  private preferredBarber(customer: CustomerOptionODataResponse): string | null {
    const barber = customer.preferredStaffMemberId;
    const value = this.value();
    if (value.staffMemberId !== '' || barber === null || customer.preferredStaffIsActive !== true) {
      return null;
    }
    const pricing = this.pricing();
    // The catalog lists the active, bookable barbers only.
    if (!pricing.catalog.staffMembers.some((member) => member.id === barber)) return null;
    if (!fitsAll(pricing, barber, value.serviceIds)) return null;
    const free = this.freeAtStart();
    return free === null || free.has(barber) ? barber : null;
  }

  /** The user typed an end: from now on it is theirs. */
  protected endEdited(): void {
    this.form().endOverridden().value.set(true);
  }

  protected resetLength(): void {
    this.form().endOverridden().value.set(false);
  }

  protected useWalkIn(): void {
    this.form().customerMode().value.set('new');
    this.form().customerId().value.set('');
    this.customerPicked.emit(null);
  }

  protected useSearch(): void {
    this.form().customerMode().value.set('existing');
  }

  protected onCustomer(
    selection: AutocompleteSelection<CustomerOptionODataResponse> | undefined,
  ): void {
    this.customerPicked.emit(selection?.item ?? null);
  }

  /** The duplicate hint's "Pick them": the existing customer instead of a new one. */
  protected useExisting(customer: CustomerOptionODataResponse): void {
    this.form().customerMode().value.set('existing');
    this.form().customerId().value.set(customer.id);
    this.customerPicked.emit(customer);
  }

  protected warningKey(warning: AppointmentWarningViewDto): string {
    return `managementAppointments.warnings.${warning.code}`;
  }

  /** The line that names the other appointment. */
  protected overlapKey(warning: AppointmentWarningViewDto): string {
    return warning.code === 'CUSTOMER_OVERLAP'
      ? 'managementAppointments.warnings.customerOverlapDetail'
      : 'managementAppointments.warnings.slotTakenDetail';
  }
}

/** An email ignores case, as the API's match does. A phone matches on its digits. */
function sameContact(lookup: DuplicateLookup, customer: CustomerOptionODataResponse): boolean {
  if (lookup.kind === 'email') {
    return customer.email?.toLowerCase() === lookup.value.toLowerCase();
  }
  const digits = customer.phoneNumber?.replace(/\D/g, '') ?? '';
  return digits !== '' && digits.endsWith(lookup.value);
}
