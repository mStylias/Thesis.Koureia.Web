import {
  Component,
  Injector,
  afterNextRender,
  computed,
  effect,
  inject,
  linkedSignal,
  signal,
  untracked,
  viewChild,
  type AnimationCallbackEvent,
} from '@angular/core';
import { rxResource, takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { FormField } from '@angular/forms/signals';
import {
  ActivatedRoute,
  NavigationCancel,
  NavigationCancellationCode,
  NavigationEnd,
  NavigationError,
  NavigationSkipped,
  Router,
  type Event as RouterEvent,
  type UrlTree,
} from '@angular/router';
import { provideTranslocoScope, TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import {
  LucideBan,
  LucideCalendarPlus,
  LucideList,
  LucideMerge,
  LucidePencil,
  LucideSave,
  LucideShieldCheck,
} from '@lucide/angular';
import { filter, firstValueFrom, map } from 'rxjs';
import { CustomersApi, emailOwnerOf, type CustomerResponse } from '@api/customers';
import { StaffAccessStore } from '@auth/data-access';
import {
  APPOINTMENTS_PAGE,
  CUSTOMER_PARAM,
  NEW_APPOINTMENT,
  appointmentsTranslocoScope,
  prefillParams,
  type OpenAppointment,
} from '@features/management-shared-appointments';
import {
  injectErrorMessageResolver,
  SYNAX_ERROR_MESSAGES,
  type SynaxErrorMessages,
} from '@synax/client';
import { Result, type HttpError } from '@synax/client/core';
import { injectFormErrors } from '@synax/forms';
import { Banner } from '@ui/banner';
import { Button, ButtonIcon } from '@ui/button';
import { ConfirmationService } from '@ui/confirmation-dialog';
import { Drawer, DrawerActions, DrawerHeader, DrawerToolbar, type DrawerAction } from '@ui/drawer';
import { Field, FieldControl, FieldEditor, FormErrors, FormHost } from '@ui/form-field';
import { InputText } from '@ui/input-text';
import { PhoneInput } from '@ui/phone-input';
import { Select, type SelectOption } from '@ui/select';
import { Textarea } from '@ui/textarea';
import { ToasterService } from '@ui/toaster';
import { formEditor, type FormFailure } from '@util/forms';

import { initialsOf } from '../customers.format';
import { CUSTOMER_APPOINTMENTS } from '../list/customers-panel-host';
import { customersTranslocoScope } from '../customers.i18n';
import { CustomersStore } from '../customers.store';
import {
  CUSTOMER_ERROR_FIELDS,
  CUSTOMER_FIELDS,
  NOTE_MAX_LENGTH,
  customerPatch,
  formFromCustomer,
} from './customer-details.form';
import type { CustomerFormValue } from './customer-details.form.types';
import type { EmailOwner } from './customer-details.types';
import { BlockCustomerDialog } from './block-customer-dialog';
import { CustomerView } from './customer-view';
import { MergeCustomersDialog } from './merge-customers-dialog';

const K = 'managementCustomers';

/** The codes this drawer has its own copy for. */
const CUSTOMER_ERROR_CODES = [
  'CUSTOMER_NOT_FOUND',
  'CUSTOMER_SPEND_FORBIDDEN',
  'CUSTOMER_INVALID_NAME',
  'CUSTOMER_INVALID_PHONE',
  'CUSTOMER_INVALID_EMAIL',
  'CUSTOMER_INVALID_NOTE',
  'CUSTOMER_EMAIL_USED_BY_WALK_IN',
  'CUSTOMER_EMAIL_USED_BY_ACCOUNT',
  'CUSTOMER_CONTACT_DETAILS_READ_ONLY',
  'CUSTOMER_INVALID_PREFERRED_STAFF',
  'CUSTOMER_UPDATE_FAILED',
  'CUSTOMER_INVALID_BLOCK_REASON',
  'CUSTOMER_MERGE_SAME_RECORD',
  'CUSTOMER_MERGE_ACCOUNT_HOLDER',
  'CUSTOMER_MERGE_NOTE_TOO_LONG',
] as const;

/**
 * One customer beside the grid. Opening another row keeps the drawer open. A row opens in view
 * mode, and Edit turns it into the form.
 *
 * Unsaved edits are never dropped silently. The drawer's own close asks through `closeGuard`, a
 * navigation asks through {@link canLeave}, and a reload asks through `beforeunload`.
 *
 * An unknown id closes the drawer with a toast: a merged walk-in and a walk-in who signed up
 * answer "not found" too, with no id to follow.
 */
@Component({
  selector: 'lib-customer-details',
  imports: [
    Banner,
    BlockCustomerDialog,
    Button,
    ButtonIcon,
    CustomerView,
    Drawer,
    DrawerActions,
    DrawerHeader,
    DrawerToolbar,
    Field,
    FieldControl,
    FieldEditor,
    FormErrors,
    FormField,
    FormHost,
    InputText,
    LucideMerge,
    LucidePencil,
    LucideSave,
    MergeCustomersDialog,
    PhoneInput,
    Select,
    Textarea,
    TranslocoPipe,
  ],
  templateUrl: './customer-details.html',
  styleUrl: './customer-details.scss',
  providers: [
    provideTranslocoScope(customersTranslocoScope, appointmentsTranslocoScope),
    { provide: SYNAX_ERROR_MESSAGES, useFactory: customerErrorMessages },
  ],
  host: {
    '(window:beforeunload)': 'onBeforeUnload($event)',
    '(animate.leave)': 'onLeave($event)',
  },
})
export class CustomerDetails {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly api = inject(CustomersApi);
  private readonly store = inject(CustomersStore);
  private readonly access = inject(StaffAccessStore);
  private readonly transloco = inject(TranslocoService);
  private readonly toaster = inject(ToasterService);
  private readonly confirmation = inject(ConfirmationService);
  private readonly errorMessage = injectErrorMessageResolver();
  private readonly formErrors = injectFormErrors();
  private readonly injector = inject(Injector);
  private readonly drawer = viewChild(Drawer);

  protected readonly noteMax = NOTE_MAX_LENGTH;

  /** `false` from the drawer's own close until the navigation it starts settles. */
  protected readonly open = signal(true);

  /** Set by the guard: the grid stays, so the exit plays over it. */
  private exitOverPage = false;

  protected readonly language = toSignal(this.transloco.langChanges$, {
    initialValue: this.transloco.getActiveLang(),
  });

  protected readonly timezone = this.store.timezone;

  /** The grid's revision, which every write bumps. */
  protected readonly revision = this.store.revision;

  protected readonly customerId = toSignal(
    this.route.paramMap.pipe(map((params) => params.get('customerId') ?? '')),
    { initialValue: '' },
  );

  private readonly customerResource = rxResource({
    params: () => this.customerId() || undefined,
    stream: ({ params }) => this.api.customer(params),
  });

  private readonly loaded = computed<CustomerResponse | null>(() => {
    const result = this.customerResource.hasValue() ? this.customerResource.value() : null;
    return result?.isSuccess === true ? result.data : null;
  });

  /** The customer on screen. It stays while the next one loads, so the drawer does not jump. */
  protected readonly customer = linkedSignal<
    { readonly loaded: CustomerResponse | null; readonly holding: boolean },
    CustomerResponse | null
  >({
    source: () => ({ loaded: this.loaded(), holding: this.customerResource.isLoading() }),
    computation: (next, previous) =>
      next.loaded ?? (next.holding ? (previous?.value ?? null) : null),
  });

  /** The customer on screen is the last one, while the next loads. Its actions wait. */
  protected readonly switching = computed(() => {
    const shown = this.customer();
    return shown !== null && shown.id !== this.customerId();
  });

  private readonly readError = computed<HttpError | null>(() => {
    if (this.customerResource.isLoading()) return null;
    const result = this.customerResource.hasValue() ? this.customerResource.value() : null;
    return result?.isFailure === true ? result.error : null;
  });

  private readonly notFound = computed(() => this.readError()?.httpCode === 404);

  protected readonly readErrorText = computed(() => {
    const error = this.readError();
    return error === null || this.notFound() ? '' : this.errorMessage(error);
  });

  protected readonly reading = computed(
    () => this.customer() === null && this.customerResource.isLoading(),
  );

  private readonly model = signal<CustomerFormValue>(formFromCustomer(null));

  protected readonly editor = formEditor({
    model: this.model,
    fields: CUSTOMER_FIELDS,
    resetOn: () => this.customerId(),
    mode: () => 'view',
    action: () => this.write(),
  });

  protected readonly canUpdate = computed(() => this.access.has('customers:update'));
  private readonly canBlock = computed(() => this.access.has('customers:block'));
  private readonly canCreateAppointment = computed(() => this.access.has('appointments:create'));
  protected readonly canReadAppointments = computed(() => this.access.has('appointments:read_all'));
  protected readonly canSeeSpend = this.store.canSeeSpend;

  /** An account holder's name, email and phone are their own: the form shows them read-only. */
  protected readonly contactMode = computed(() =>
    this.customer()?.canEditContactDetails === true ? undefined : ('view' as const),
  );

  /**
   * The toolbar's captions, per language. Full keys: the drawer provides two scopes, so a
   * scope-relative read would name the appointments scope's actions. The route preloads this one.
   */
  private readonly actionLabels = computed<Record<string, string>>(() => {
    this.language();
    const label = (key: string): string => this.transloco.translate(`${K}.actions.${key}`);
    return {
      newAppointment: label('newAppointment'),
      allAppointments: label('allAppointments'),
      block: label('block'),
      unblock: label('unblock'),
      merge: label('merge'),
    };
  });

  /** An unblock in flight. */
  protected readonly acting = signal(false);

  protected readonly blockOpen = signal(false);
  protected readonly mergeOpen = signal(false);

  /** The other walk-in the merge dialog opens on, from the email clash. `null` lets it ask. */
  protected readonly mergeOtherId = signal<string | null>(null);

  /** The walk-in that holds the email the last save tried to give this one. */
  private readonly emailOwner = signal<EmailOwner | null>(null);

  /** The email clash offers a merge while the email is still the one refused. */
  protected readonly clashOwnerId = computed(() => {
    const owner = this.emailOwner();
    if (owner === null || this.customer()?.canMerge !== true) return null;
    return this.model().email.trim() === owner.email ? owner.customerId : null;
  });

  /**
   * Νέο ραντεβού, Όλα τα ραντεβού, Αποκλεισμός or Άρση αποκλεισμού, then Συγχώνευση. The drawer
   * folds the last ones into ⋮ first. Edit is the end slot. Editing hides the group.
   */
  protected readonly toolbarActions = computed<readonly DrawerAction[]>(() => {
    const viewed = this.customer();
    if (viewed === null || this.editor.editing()) return [];
    const labels = this.actionLabels();
    const actions: DrawerAction[] = [];
    if (this.canCreateAppointment()) {
      actions.push({
        id: 'newAppointment',
        label: labels['newAppointment'] ?? '',
        icon: LucideCalendarPlus,
        run: () => {
          void this.router.navigate([CUSTOMER_APPOINTMENTS, NEW_APPOINTMENT], {
            relativeTo: this.route,
            queryParams: prefillParams({ customerId: viewed.id }),
          });
        },
      });
    }
    if (this.canReadAppointments()) {
      actions.push({
        id: 'allAppointments',
        label: labels['allAppointments'] ?? '',
        icon: LucideList,
        link: this.appointmentsLinkOf(viewed.id),
      });
    }
    if (this.canBlock()) {
      const blocked = viewed.block !== null;
      actions.push({
        id: 'block',
        label: labels[blocked ? 'unblock' : 'block'] ?? '',
        icon: blocked ? LucideShieldCheck : LucideBan,
        severity: blocked ? 'secondary' : 'error',
        loading: this.acting(),
        run: () => {
          if (blocked) void this.unblock();
          else this.blockOpen.set(true);
        },
      });
    }
    // `canMerge` is true only for a walk-in, when the caller holds `customers:merge`.
    if (viewed.canMerge) {
      actions.push({
        id: 'merge',
        label: labels['merge'] ?? '',
        icon: LucideMerge,
        disabled: this.acting(),
        run: () => {
          this.openMerge(null);
        },
      });
    }
    return actions;
  });

  /** "View all" of the appointment list: the appointments grid on this customer. */
  protected readonly appointmentsLink = computed(() => {
    const id = this.customer()?.id;
    return id === undefined ? null : this.appointmentsLinkOf(id);
  });

  protected readonly initials = computed(() => {
    const shown = this.customer();
    return shown === null ? '' : initialsOf(shown.firstName, shown.lastName, shown.displayName);
  });

  protected readonly heading = computed(() => {
    this.language();
    if (this.editor.editing()) return this.transloco.translate(`${K}.panel.edit`);
    return this.customer()?.displayName ?? this.transloco.translate(`${K}.panel.customer`);
  });

  /** The active barbers, the saved one if it has since left, and "No preference". */
  protected readonly barberOptions = computed<readonly SelectOption<string>[]>(() => {
    this.language();
    const saved = this.customer();
    const options: SelectOption<string>[] = [
      { value: '', label: this.transloco.translate(`${K}.form.noPreference`) },
      ...this.store.activeBarbers().map((member) => ({
        value: member.id,
        label: member.displayName,
      })),
    ];
    const savedId = saved?.preferredStaffMemberId ?? null;
    if (savedId !== null && !options.some((option) => option.value === savedId)) {
      options.push({
        value: savedId,
        label: this.transloco.translate(`${K}.form.inactive`, {
          name: saved?.preferredStaffDisplayName ?? '',
        }),
        // Kept as the current value, never chosen again: the API refuses an inactive barber.
        disabled: true,
      });
    }
    return options;
  });

  protected readonly noteLength = computed(() => this.model().note.length);

  /** The drawer's ×, Escape and Cancel ask the same question a navigation does. */
  protected readonly closeGuard = (): Promise<boolean> => this.canLeave();

  constructor() {
    // The form follows the record while nobody edits it.
    effect(() => {
      const customer = this.customer();
      untracked(() => {
        if (customer !== null && !this.editor.editing()) {
          this.editor.reset(formFromCustomer(customer));
        }
      });
    });

    // Not found closes the drawer: an unknown id, another shop's walk-in, a walk-in merged away
    // or one whose person signed up. None has an id to follow.
    effect(() => {
      if (!this.notFound()) return;
      untracked(() => {
        this.toaster.error(this.transloco.translate(`${K}.toast.notFound`));
        this.editor.reset();
        this.close();
      });
    });

    // Another record opens at the top, in the same frame it is drawn.
    let shownId: string | null = null;
    effect(() => {
      const id = this.customer()?.id ?? null;
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

    // A close whose navigation did not happen opens the drawer again.
    this.router.events.pipe(filter(settled), takeUntilDestroyed()).subscribe(() => {
      if (!this.open()) this.open.set(true);
    });
  }

  /** Whether the drawer may go: yes unless an edit holds changes the user does not discard. */
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

  /** Called by the guard before the route goes. Over a grid that stays, the exit plays. */
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

  /** The drawer's own close: the ×, Escape. The grid shows at once, and the exit plays over it. */
  protected onVisibleChange(visible: boolean): void {
    this.open.set(visible);
    if (!visible) this.close();
  }

  protected edit(): void {
    const customer = this.customer();
    if (customer === null || !this.canUpdate()) return;
    this.editor.reset(formFromCustomer(customer));
    this.editor.mode.set('edit');
  }

  protected async cancelEdit(): Promise<void> {
    if (!(await this.canLeave())) return;
    this.editor.reset(formFromCustomer(this.customer()));
    this.editor.mode.set('view');
  }

  protected save(): void {
    void this.editor.commit();
  }

  protected reload(): void {
    this.customerResource.reload();
  }

  /** The merge dialog, on the record the email clash named, or asking for one. */
  protected openMerge(otherId: string | null): void {
    this.mergeOtherId.set(otherId);
    this.mergeOpen.set(true);
  }

  /** The merge from the edit form's email clash. The edit is dropped: the merge decides. */
  protected mergeFromClash(otherId: string): void {
    this.editor.reset(formFromCustomer(this.customer()));
    this.editor.mode.set('view');
    this.openMerge(otherId);
  }

  /** A block, an unblock or a merge answered the customer as saved. */
  protected showSaved(customer: CustomerResponse): void {
    this.customerResource.set(Result.Ok(customer));
    this.store.reload();
  }

  /** Asks first. Unblocking a customer who is not blocked succeeds and changes nothing. */
  protected async unblock(): Promise<void> {
    const customer = this.customer();
    if (customer === null || this.acting()) return;
    const answer = await this.confirmation.open({
      title: this.transloco.translate(`${K}.unblock.title`),
      message: this.transloco.translate(`${K}.unblock.message`),
      confirmLabel: this.transloco.translate(`${K}.unblock.confirm`),
      cancelLabel: this.transloco.translate(`${K}.unblock.cancel`),
      severity: 'warning',
    });
    if (answer !== 'confirmed') return;

    this.acting.set(true);
    const result = await firstValueFrom(this.api.unblock(customer.id));
    this.acting.set(false);
    if (!result.isSuccess) {
      if (result.error.httpCode === 404) this.customerResource.set(result);
      else this.toaster.error(this.errorMessage(result.error));
      return;
    }
    this.toaster.success(this.transloco.translate(`${K}.unblock.toast`));
    if (result.data === null) this.customerResource.reload();
    else this.showSaved(result.data);
  }

  /** An appointment of the history, in this drawer's place. Its close comes back here. */
  protected readonly appointmentLink = (appointment: OpenAppointment): UrlTree =>
    this.router.createUrlTree([CUSTOMER_APPOINTMENTS, appointment.id], { relativeTo: this.route });

  private appointmentsLinkOf(customerId: string) {
    return this.router.createUrlTree(['../..', APPOINTMENTS_PAGE], {
      relativeTo: this.route,
      queryParams: { [CUSTOMER_PARAM]: customerId },
    });
  }

  private close(): void {
    void this.router.navigate(['..'], { relativeTo: this.route });
  }

  /**
   * The save: only what changed, so another person's edit of a different member survives. The
   * answer is the customer as saved, which the view shows.
   */
  private async write(): Promise<FormFailure | undefined> {
    const saved = this.customer();
    if (saved === null) return undefined;
    const patch = customerPatch(saved, this.model());

    if (Object.keys(patch).length === 0) {
      this.editor.mode.set('view');
      return undefined;
    }

    this.emailOwner.set(null);
    const result = await firstValueFrom(this.api.update(saved.id, patch));
    if (!result.isSuccess) {
      if (result.error.httpCode === 404) {
        this.customerResource.set(result);
        return undefined;
      }
      const owner = emailOwnerOf(result.error);
      if (owner !== null) {
        this.emailOwner.set({ customerId: owner, email: this.model().email.trim() });
      }
      return this.formErrors(result.error, CUSTOMER_ERROR_FIELDS);
    }

    this.toaster.success(this.transloco.translate(`${K}.toast.updated`));
    this.store.reload();
    this.editor.reset(formFromCustomer(result.data));
    if (result.data === null) {
      this.customerResource.reload();
    } else {
      this.customerResource.set(result);
    }
    this.editor.mode.set('view');
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

/** The drawer's own copy for the codes it knows, over whatever the app registered. */
function customerErrorMessages(): SynaxErrorMessages {
  const transloco = inject(TranslocoService);
  const parent = inject(SYNAX_ERROR_MESSAGES, { optional: true, skipSelf: true }) ?? {};
  const codes = Object.fromEntries(
    CUSTOMER_ERROR_CODES.map((code) => [code, () => transloco.translate(`${K}.errors.${code}`)]),
  );
  return { ...parent, codes: { ...parent.codes, ...codes } };
}
