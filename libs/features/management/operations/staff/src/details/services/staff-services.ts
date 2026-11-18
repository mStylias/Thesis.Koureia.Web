import {
  Component,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
  untracked,
} from '@angular/core';
import { FormField } from '@angular/forms/signals';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { firstValueFrom } from 'rxjs';
import { StaffApi, type StaffMemberResponse } from '@api/staff';
import { injectFormErrors } from '@synax/forms';
import { Checkbox } from '@ui/checkbox';
import { FormErrors, FormHost } from '@ui/form-field';
import { InputNumber } from '@ui/input-number';
import { ToasterService } from '@ui/toaster';
import { formEditor, type FormFailure } from '@util/forms';

import { sameValue } from '../../form/form-values';
import {
  serviceGroups,
  servicesForm,
  servicesRequest,
  toFormRows,
} from '../../form/services-draft';
import { MINUTES_STEP, servicesLiveRules, servicesRules } from '../../form/services.form';
import type { ServiceGroupView, ServicesFormValue } from '../../form/services.form.types';
import { StaffStore } from '../../staff.store';
import type { StaffTabEditor } from '../staff-member-details.types';

const K = 'managementStaff.services';

/**
 * What the member offers, and at what own price and duration. The services drawer's barber rows,
 * turned around: one row per service, grouped by category.
 */
@Component({
  selector: 'lib-staff-services',
  imports: [Checkbox, FormErrors, FormField, FormHost, InputNumber, TranslocoPipe],
  templateUrl: './staff-services.html',
  styleUrl: './staff-services.scss',
})
export class StaffServices implements StaffTabEditor {
  private readonly api = inject(StaffApi);
  protected readonly store = inject(StaffStore);
  private readonly transloco = inject(TranslocoService);
  private readonly toaster = inject(ToasterService);
  private readonly formErrors = injectFormErrors();

  readonly member = input.required<StaffMemberResponse>();
  readonly editable = input(false);
  readonly language = input.required<string>();

  /** The saved member: the drawer shows it, and its warnings depend on it. */
  readonly changed = output<StaffMemberResponse>();

  protected readonly step = MINUTES_STEP;

  private readonly model = signal<ServicesFormValue>({ rows: [] });
  private readonly loaded = signal<ServicesFormValue>({ rows: [] });

  protected readonly editor = formEditor({
    model: this.model,
    rules: servicesRules,
    liveRules: servicesLiveRules,
    resetOn: () => this.member().id,
    mode: () => 'view',
    action: () => this.write(),
  });

  readonly editing = this.editor.editing;
  readonly submitting = this.editor.submitting;
  readonly canEdit = computed(() => this.editable() && this.store.options() !== null);

  protected readonly options = this.store.options;

  protected readonly groups = computed<readonly ServiceGroupView[]>(() => {
    this.language();
    return serviceGroups(
      this.model(),
      this.options(),
      this.transloco.translate(`${K}.uncategorized`),
    );
  });

  /** The member's services as the view lists them, grouped like the form. */
  protected readonly assignedGroups = computed<readonly ServiceGroupView[]>(() => {
    this.language();
    const assigned = servicesForm(this.member().services, this.options());
    const selected = { rows: assigned.rows.filter((row) => row.selected) };
    return serviceGroups(selected, this.options(), this.transloco.translate(`${K}.uncategorized`));
  });

  protected readonly own = computed(
    () => new Map(this.member().services.map((service) => [service.serviceId, service])),
  );

  protected readonly money = computed(
    () =>
      new Intl.NumberFormat(this.language(), {
        style: 'currency',
        currency: this.store.currency(),
        minimumFractionDigits: 2,
      }),
  );

  constructor() {
    // The form follows the member, and the options name its rows.
    effect(() => {
      const services = this.member().services;
      const options = this.options();
      untracked(() => {
        if (!this.editor.editing()) this.load(servicesForm(services, options));
      });
    });
  }

  hasChanges(): boolean {
    return this.editor.editing() && !sameValue(this.model(), this.loaded());
  }

  edit(): void {
    if (!this.canEdit()) return;
    this.load(servicesForm(this.member().services, this.options()));
    this.editor.mode.set('edit');
  }

  save(): void {
    void this.editor.commit();
  }

  discard(): void {
    this.load(servicesForm(this.member().services, this.options()));
    this.editor.mode.set('view');
  }

  /** Whether every row of a group is selected, some are, or none. */
  protected groupState(group: ServiceGroupView): 'all' | 'some' | 'none' {
    const rows = this.model().rows;
    const selected = group.rows.filter((row) => rows.at(row.index)?.selected === true).length;
    return selected === 0 ? 'none' : selected === group.rows.length ? 'all' : 'some';
  }

  protected selectGroup(group: ServiceGroupView, selected: boolean): void {
    const indexes = new Set(group.rows.map((row) => row.index));
    this.model.update((value) => ({
      rows: value.rows.map((row, index) => (indexes.has(index) ? { ...row, selected } : row)),
    }));
  }

  protected minutes(count: number): string {
    return this.transloco.translate(`${K}.minutes`, { count });
  }

  private load(value: ServicesFormValue): void {
    this.editor.reset(value);
    this.loaded.set(value);
  }

  private async write(): Promise<FormFailure | undefined> {
    const { request, rows } = servicesRequest(this.model());
    const result = await firstValueFrom(this.api.updateServices(this.member().id, request));
    if (!result.isSuccess) return toFormRows(this.formErrors(result.error), rows);

    this.toaster.success(this.transloco.translate('managementStaff.toast.servicesUpdated'));
    const saved = result.data;
    if (saved !== null) {
      this.load(servicesForm(saved.services, this.options()));
      this.changed.emit(saved);
    }
    this.editor.mode.set('view');
    return undefined;
  }
}
