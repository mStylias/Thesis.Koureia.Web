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
} from '@angular/router';
import {
  provideTranslocoScope,
  translateObjectSignal,
  TranslocoPipe,
  TranslocoService,
} from '@jsverse/transloco';
import {
  LucideCircleCheck,
  LucideCircleOff,
  LucidePencil,
  LucidePlus,
  LucideSave,
  LucideScissors,
  LucideTrash2,
} from '@lucide/angular';
import { filter, firstValueFrom, map } from 'rxjs';
import {
  ServicesApi,
  type CreateServiceRequest,
  type ServiceCategoryResponse,
  type ServiceResponse,
} from '@api/services';
import { StaffAccessStore } from '@auth/data-access';
import {
  injectErrorMessageResolver,
  SYNAX_ERROR_MESSAGES,
  type SynaxErrorMessages,
} from '@synax/client';
import type { HttpError, Result } from '@synax/client/core';
import { injectFormErrors } from '@synax/forms';
import { Banner } from '@ui/banner';
import { Button, ButtonIcon } from '@ui/button';
import { Checkbox } from '@ui/checkbox';
import { ConfirmationService } from '@ui/confirmation-dialog';
import { Drawer, DrawerActions, DrawerHeader, DrawerToolbar, type DrawerAction } from '@ui/drawer';
import { Field, FieldControl, FieldEditor, FormErrors, FormHost } from '@ui/form-field';
import { InputNumber } from '@ui/input-number';
import { InputText } from '@ui/input-text';
import { Select, type SelectOption } from '@ui/select';
import { Switch } from '@ui/switch';
import { Textarea } from '@ui/textarea';
import { ToasterService } from '@ui/toaster';
import { Tooltip } from '@ui/tooltip';
import { formEditor, type FormFailure } from '@util/forms';

import { servicesTranslocoScope } from '../services.i18n';
import { CategoryDialog } from '../category/category-dialog';
import type { CategoryChange } from '../category/category-dialog.types';
import {
  activeRequest,
  describeStaffRows,
  emptyServiceForm,
  formFromService,
  serviceRequest,
  toFormStaffRows,
} from '../form/service-draft';
import {
  BUFFER_MAX,
  DURATION_MAX,
  DURATION_MIN,
  MINUTES_STEP,
  PRICE_MAX,
  SERVICE_FIELDS,
  serviceLiveRules,
  serviceRules,
} from '../form/service.form';
import type { ServiceFormValue } from '../form/service.form.types';
import { ServicesStore } from '../services.store';
import { NEW_SERVICE } from './service-details.constants';
import { ServiceView } from './service-view';
import type { CategoryDialogState, ServiceStaffView } from './service-details.types';

const K = 'managementServices';

/** The codes this drawer has its own copy for. */
const SERVICE_ERROR_CODES = [
  'SERVICE_NOT_FOUND',
  'SERVICE_FETCH_FAILED',
  'SERVICE_CREATE_FAILED',
  'SERVICE_UPDATE_FAILED',
  'SERVICE_DELETE_FAILED',
  'SERVICE_INVALID_NAME',
  'SERVICE_INVALID_DESCRIPTION',
  'SERVICE_INVALID_PRICE',
  'SERVICE_INVALID_DURATION',
  'SERVICE_INVALID_BUFFER',
  'SERVICE_MISSING_TRANSLATION',
  'SERVICE_INVALID_TRANSLATION',
  'SERVICE_NAME_TAKEN',
  'SERVICE_IN_USE',
  'SERVICE_UNKNOWN_CATEGORY',
  'SERVICE_UNKNOWN_STAFF_MEMBER',
  'SERVICE_DUPLICATE_STAFF_MEMBER',
  'SERVICE_CATEGORY_NOT_FOUND',
  'SERVICE_CATEGORY_FETCH_FAILED',
  'SERVICE_CATEGORY_CREATE_FAILED',
  'SERVICE_CATEGORY_UPDATE_FAILED',
  'SERVICE_CATEGORY_DELETE_FAILED',
  'SERVICE_CATEGORY_NOT_OWNED',
  'SERVICE_CATEGORY_INVALID_NAME',
  'SERVICE_CATEGORY_MISSING_TRANSLATION',
  'SERVICE_CATEGORY_INVALID_TRANSLATION',
  'SERVICE_CATEGORY_NAME_TAKEN',
] as const;

/**
 * One service, or a new one, beside the grid. `services/new` and `services/<id>` are one route, so
 * opening another row keeps the drawer open. A row opens in view mode, and Edit turns it into the
 * form.
 *
 * Unsaved edits are never dropped silently. The drawer's own close asks through `closeGuard`, a
 * navigation asks through {@link canLeave}, and a reload asks through `beforeunload`.
 */
@Component({
  selector: 'lib-service-details',
  imports: [
    Banner,
    Button,
    ButtonIcon,
    CategoryDialog,
    Checkbox,
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
    InputNumber,
    InputText,
    LucidePencil,
    LucidePlus,
    LucideSave,
    LucideScissors,
    Select,
    ServiceView,
    Switch,
    Textarea,
    Tooltip,
    TranslocoPipe,
  ],
  templateUrl: './service-details.html',
  styleUrl: './service-details.scss',
  providers: [
    provideTranslocoScope(servicesTranslocoScope),
    { provide: SYNAX_ERROR_MESSAGES, useFactory: serviceErrorMessages },
  ],
  host: {
    '(window:beforeunload)': 'onBeforeUnload($event)',
    '(animate.leave)': 'onLeave($event)',
  },
})
export class ServiceDetails {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly api = inject(ServicesApi);
  private readonly store = inject(ServicesStore);
  private readonly access = inject(StaffAccessStore);
  private readonly transloco = inject(TranslocoService);
  private readonly toaster = inject(ToasterService);
  private readonly confirmation = inject(ConfirmationService);
  private readonly errorMessage = injectErrorMessageResolver();
  private readonly formErrors = injectFormErrors();
  private readonly injector = inject(Injector);
  private readonly drawer = viewChild(Drawer);

  protected readonly limits = {
    priceMax: PRICE_MAX,
    durationMin: DURATION_MIN,
    durationMax: DURATION_MAX,
    bufferMax: BUFFER_MAX,
    step: MINUTES_STEP,
  };

  /** `false` from the drawer's own close until the navigation it starts settles. */
  protected readonly open = signal(true);

  /** Set by the guard: the grid stays, so the exit plays over it. */
  private exitOverPage = false;

  protected readonly language = toSignal(this.transloco.langChanges$, {
    initialValue: this.transloco.getActiveLang(),
  });

  protected readonly serviceId = toSignal(
    this.route.paramMap.pipe(map((params) => params.get('serviceId') ?? NEW_SERVICE)),
    { initialValue: NEW_SERVICE },
  );

  private readonly isNew = computed(() => this.serviceId() === NEW_SERVICE);

  private readonly serviceResource = rxResource({
    params: () => (this.isNew() ? undefined : this.serviceId()),
    stream: ({ params }) => this.api.service(params),
  });

  private readonly loaded = computed<ServiceResponse | null>(() => {
    const result = this.serviceResource.hasValue() ? this.serviceResource.value() : null;
    return result?.isSuccess === true ? result.data : null;
  });

  /** The service on screen. It stays while the next one loads, so the drawer does not jump. */
  protected readonly service = linkedSignal<
    { readonly loaded: ServiceResponse | null; readonly holding: boolean },
    ServiceResponse | null
  >({
    source: () => ({
      loaded: this.isNew() ? null : this.loaded(),
      holding: !this.isNew() && this.serviceResource.isLoading(),
    }),
    computation: (next, previous) =>
      next.loaded ?? (next.holding ? (previous?.value ?? null) : null),
  });

  /** The service on screen is the last one, while the next loads. Its actions wait. */
  protected readonly switching = computed(() => {
    const shown = this.service();
    return shown !== null && shown.id !== this.serviceId();
  });

  private readonly readError = computed<HttpError | null>(() => {
    if (this.serviceResource.isLoading()) return null;
    const result = this.serviceResource.hasValue() ? this.serviceResource.value() : null;
    return result?.isFailure === true ? result.error : null;
  });

  protected readonly notFound = computed(() => this.readError()?.httpCode === 404);
  protected readonly readErrorText = computed(() => {
    const error = this.readError();
    return error === null ? '' : this.errorMessage(error);
  });

  protected readonly reading = computed(
    () => !this.isNew() && this.service() === null && this.serviceResource.isLoading(),
  );

  protected readonly options = this.store.options;
  protected readonly optionsFailed = this.store.optionsFailed;
  protected readonly currency = this.store.currency;

  private readonly model = signal<ServiceFormValue>(emptyServiceForm(null));

  protected readonly editor = formEditor({
    model: this.model,
    fields: SERVICE_FIELDS,
    resetOn: () => this.serviceId(),
    mode: (id) => (id === NEW_SERVICE ? 'create' : 'view'),
    rules: serviceRules,
    liveRules: serviceLiveRules,
    action: () => this.write(),
  });

  protected readonly canCreate = computed(() => this.access.has('services:create'));
  protected readonly canUpdate = computed(() => this.access.has('services:update'));
  protected readonly canDelete = computed(() => this.access.has('services:delete'));

  /** A write from the view's toolbar in flight: activate, deactivate, delete. */
  protected readonly acting = signal(false);

  /** Reads the scope's copy as a signal, so the toolbar follows a language change. */
  private readonly actionLabels = translateObjectSignal('actions');

  /**
   * The toolbar's group: Deactivate or Activate, then Delete. The drawer folds the last one into
   * ⋮ first. Edit, Cancel and Save are the end slot. Editing hides the group.
   */
  protected readonly toolbarActions = computed<readonly DrawerAction[]>(() => {
    const viewed = this.service();
    if (viewed === null || this.editor.editing()) return [];
    const labels = this.actionLabels() as Record<string, string>;
    const acting = this.acting();
    const actions: DrawerAction[] = [];
    if (this.canUpdate()) {
      actions.push({
        id: 'active',
        label: labels[viewed.isActive ? 'deactivate' : 'activate'] ?? '',
        icon: viewed.isActive ? LucideCircleOff : LucideCircleCheck,
        loading: acting,
        run: () => {
          void this.setActive(!viewed.isActive);
        },
      });
    }
    // Withheld, not disabled, once the service is on an appointment: Deactivate is the way.
    if (this.canDelete() && viewed.canDelete) {
      actions.push({
        id: 'delete',
        label: labels['delete'] ?? '',
        icon: LucideTrash2,
        severity: 'error',
        variant: 'text',
        disabled: acting,
        run: () => {
          void this.remove();
        },
      });
    }
    return actions;
  });

  /** The barber rows the form draws, beside the form value they bind. */
  protected readonly staffRows = computed(() =>
    describeStaffRows(this.model().staff, this.options()),
  );

  /** A category the dialog just wrote, shown until the options reload lists it. */
  private readonly pendingCategory = signal<ServiceCategoryResponse | null>(null);

  protected readonly categories = computed<readonly ServiceCategoryResponse[]>(() => {
    const listed = this.store.categories();
    const pending = this.pendingCategory();
    return pending === null || listed.some((category) => category.id === pending.id)
      ? listed
      : [...listed, pending];
  });

  protected readonly categoryOptions = computed<readonly SelectOption<string>[]>(() => {
    this.language();
    return [
      { value: '', label: this.transloco.translate(`${K}.uncategorized`) },
      ...this.categories().map((category) => ({ value: category.id, label: category.name })),
    ];
  });

  /** The category the form holds, when the shop owns it: the pencil offers a rename. */
  protected readonly ownedCategory = computed(() => {
    const id = this.model().categoryId;
    return this.categories().find((category) => category.id === id && category.isOwned) ?? null;
  });

  protected readonly categoryDialog = signal<CategoryDialogState | null>(null);
  protected readonly categoryDialogOpen = linkedSignal(() => this.categoryDialog() !== null);

  protected readonly money = computed(
    () =>
      new Intl.NumberFormat(this.language(), {
        style: 'currency',
        currency: this.currency(),
        minimumFractionDigits: 2,
      }),
  );

  /** The base values, as the placeholders of a barber's empty own values. */
  protected readonly basePrice = computed(() => {
    const price = this.model().price;
    return price === null ? '' : this.money().format(price);
  });

  protected readonly baseDuration = computed(() => {
    const minutes = this.model().durationMinutes;
    this.language();
    return minutes === null ? '' : this.transloco.translate(`${K}.minutes`, { count: minutes });
  });

  /** Duration plus both buffers, for the line under the times. */
  protected readonly calendarMinutes = computed(() => {
    const value = this.model();
    return (
      (value.durationMinutes ?? 0) +
      (value.bufferBeforeMinutes ?? 0) +
      (value.bufferAfterMinutes ?? 0)
    );
  });

  /** The name in the page language, else the first one. */
  protected readonly serviceName = computed(() => {
    const translations = this.service()?.translations ?? [];
    return (
      translations.find((item) => item.languageCode === this.language())?.name ??
      translations.at(0)?.name ??
      ''
    );
  });

  protected readonly heading = computed(() => {
    this.language();
    const mode = this.editor.mode();
    if (mode === 'create') return this.transloco.translate(`${K}.panel.new`);
    if (mode === 'edit') return this.transloco.translate(`${K}.panel.edit`);
    return this.serviceName() || this.transloco.translate(`${K}.panel.service`);
  });

  /** The category's name for the view. */
  protected readonly categoryName = computed(() => {
    const id = this.service()?.categoryId ?? null;
    if (id === null) return this.transloco.translate(`${K}.view.uncategorized`);
    return this.categories().find((category) => category.id === id)?.name ?? '';
  });

  /** The barbers who perform the service, for the view, with their own values. */
  protected readonly assigned = computed<readonly ServiceStaffView[]>(() => {
    const service = this.service();
    if (service === null) return [];
    const members = new Map(this.store.staffMembers().map((member) => [member.id, member]));
    return service.staff.map((own) => {
      const member = members.get(own.staffMemberId);
      return {
        staffMemberId: own.staffMemberId,
        displayName: member?.displayName ?? '',
        isActive: member?.isActive ?? false,
        isBookable: member?.isBookable ?? false,
        customPrice: own.customPrice,
        customDurationMinutes: own.customDurationMinutes,
      };
    });
  });

  /** Why online customers cannot book the service, or `null` when they can. */
  protected readonly notBookableReason = computed<'inactive' | 'noBarbers' | null>(() => {
    const service = this.service();
    if (service === null || this.options() === null) return null;
    if (!service.isActive) return 'inactive';
    return this.assigned().some((member) => member.isActive && member.isBookable)
      ? null
      : 'noBarbers';
  });

  /** The drawer's ×, Escape and Cancel ask the same question a navigation does. */
  protected readonly closeGuard = (): Promise<boolean> => this.canLeave();

  constructor() {
    // The form follows the record while nobody edits it. The options name its barber rows, so
    // their arrival rebuilds it too.
    effect(() => {
      const service = this.service();
      const options = this.options();
      untracked(() => {
        if (!this.isNew() && service !== null && !this.editor.editing()) {
          this.editor.reset(formFromService(service, options));
        }
      });
    });

    // A create starts from the options: one block per language and every bookable barber.
    effect(() => {
      if (!this.isNew()) return;
      const options = this.options();
      untracked(() => {
        if (!this.editor.form().dirty()) this.editor.reset(emptyServiceForm(options));
      });
    });

    // Another record opens at the top, in the same frame it is drawn.
    let shownId: string | null = null;
    effect(() => {
      const id = this.service()?.id ?? null;
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
    const service = this.service();
    if (service === null || !this.canUpdate()) return;
    this.editor.reset(formFromService(service, this.options()));
    this.editor.mode.set('edit');
  }

  /** An edit goes back to view. A create has nothing behind it, so it closes. */
  protected async cancelEdit(): Promise<void> {
    if (!(await this.canLeave())) return;
    if (this.editor.creating()) {
      this.close();
      return;
    }
    const service = this.service();
    this.editor.reset(service === null ? undefined : formFromService(service, this.options()));
    this.editor.mode.set('view');
  }

  protected save(): void {
    void this.editor.commit();
  }

  protected reload(): void {
    this.serviceResource.reload();
  }

  protected reloadOptions(): void {
    void this.store.loadOptions();
  }

  protected newCategory(): void {
    this.categoryDialog.set({ category: null });
  }

  protected editCategory(): void {
    const category = this.ownedCategory();
    if (category !== null) this.categoryDialog.set({ category });
  }

  /** Selects what the dialog wrote. A deleted category leaves the form uncategorized. */
  protected onCategoryChange(change: CategoryChange): void {
    const categoryId = this.editor.form.categoryId;
    if (change.kind === 'saved') {
      this.pendingCategory.set(change.category);
      categoryId().value.set(change.category.id);
      return;
    }
    if (categoryId().value() === change.id) categoryId().value.set('');
    if (this.service()?.categoryId === change.id) this.serviceResource.reload();
  }

  protected async setActive(isActive: boolean): Promise<void> {
    const service = this.service();
    if (service === null || this.acting()) return;
    this.acting.set(true);
    const result = await firstValueFrom(
      this.api.updateService(service.id, activeRequest(service, isActive)),
    );
    this.acting.set(false);
    if (!result.isSuccess) {
      this.toaster.error(this.errorMessage(result.error));
      return;
    }
    this.serviceResource.set(result);
    this.written();
    this.toaster.success(
      this.transloco.translate(`${K}.toast.${isActive ? 'activated' : 'deactivated'}`),
    );
  }

  /** Deletes after a confirmation. A service on an appointment offers Deactivate instead. */
  protected async remove(): Promise<void> {
    const service = this.service();
    if (service === null || this.acting()) return;
    const name = this.serviceName();

    const answer = await this.confirmation.open({
      title: this.transloco.translate(`${K}.delete.title`),
      message: this.transloco.translate(`${K}.delete.message`, { name }),
      confirmLabel: this.transloco.translate(`${K}.delete.confirm`),
      cancelLabel: this.transloco.translate(`${K}.delete.cancel`),
      severity: 'error',
    });
    if (answer !== 'confirmed') return;

    this.acting.set(true);
    const result = await firstValueFrom(this.api.deleteService(service.id));
    this.acting.set(false);

    if (!result.isSuccess) {
      if (result.error.errorCode === 'SERVICE_IN_USE') {
        // A booking landed between the read and the click.
        this.serviceResource.reload();
        await this.offerDeactivate(name, service.isActive);
      } else {
        this.toaster.error(this.errorMessage(result.error));
      }
      return;
    }

    this.toaster.success(this.transloco.translate(`${K}.toast.deleted`));
    this.written();
    this.close();
  }

  private async offerDeactivate(name: string, isActive: boolean): Promise<void> {
    if (!isActive || !this.canUpdate()) {
      this.toaster.error(this.transloco.translate(`${K}.errors.SERVICE_IN_USE`));
      return;
    }
    const answer = await this.confirmation.open({
      title: this.transloco.translate(`${K}.inUse.title`),
      message: this.transloco.translate(`${K}.inUse.message`, { name }),
      confirmLabel: this.transloco.translate(`${K}.inUse.deactivate`),
      cancelLabel: this.transloco.translate(`${K}.inUse.cancel`),
      severity: 'warning',
    });
    if (answer === 'confirmed') await this.setActive(false);
  }

  private close(): void {
    void this.router.navigate(['..'], { relativeTo: this.route });
  }

  /** The grid shows the write, and the options recount the categories. */
  private written(): void {
    this.store.reload();
    void this.store.loadOptions();
  }

  /**
   * The save. A create moves the address to the new id, which resets the editor to a view of it.
   * The form is reset first, so the navigation does not ask to discard what was just saved.
   */
  private async write(): Promise<FormFailure | undefined> {
    const creating = this.editor.creating();
    const { request, staffRows } = serviceRequest(this.model());

    const result: Result<ServiceResponse> = await firstValueFrom(
      creating
        ? this.api.createService(request)
        : this.api.updateService(this.serviceId(), request satisfies CreateServiceRequest),
    );

    if (!result.isSuccess) {
      return toFormStaffRows(this.formErrors(result.error), staffRows);
    }

    this.toaster.success(
      this.transloco.translate(`${K}.toast.${creating ? 'created' : 'updated'}`),
    );
    this.written();
    const saved = result.data;
    if (saved === null) {
      this.editor.reset();
      if (creating) this.close();
      else this.reload();
      return undefined;
    }
    this.editor.reset(formFromService(saved, this.options()));
    if (creating) {
      await this.router.navigate(['..', saved.id], { relativeTo: this.route, replaceUrl: true });
    } else {
      this.serviceResource.set(result);
      this.editor.mode.set('view');
    }
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
function serviceErrorMessages(): SynaxErrorMessages {
  const transloco = inject(TranslocoService);
  const parent = inject(SYNAX_ERROR_MESSAGES, { optional: true, skipSelf: true }) ?? {};
  const codes = Object.fromEntries(
    SERVICE_ERROR_CODES.map((code) => [code, () => transloco.translate(`${K}.errors.${code}`)]),
  );
  return { ...parent, codes: { ...parent.codes, ...codes } };
}
