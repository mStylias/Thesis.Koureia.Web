import {
  afterNextRender,
  Component,
  computed,
  effect,
  inject,
  Injector,
  input,
  linkedSignal,
  output,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import { provideTranslocoScope, TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { LucideStore } from '@lucide/angular';
import { firstValueFrom } from 'rxjs';
import {
  StaffApi,
  type StaffConflictViewDto,
  type StaffScheduleChangeResponse,
  type StaffWorkHourViewDto,
} from '@api/staff';
import { injectFormErrors } from '@synax/forms';
import { Button, ButtonIcon } from '@ui/button';
import { FormErrors, FormHost } from '@ui/form-field';
import { ToasterService } from '@ui/toaster';
import { formEditor, type FormFailure } from '@util/forms';

import { StaffConflicts } from '../conflicts/staff-conflicts';
import { STAFF_SCHEDULE_CONTEXT } from '../context/staff-schedule-context';
import { sameValue } from '../form/form-values';
import {
  hoursRequest,
  outsideShop,
  shopWindows,
  toFormRanges,
  weekFromHours,
  weekFromShop,
} from '../form/hours-draft';
import { hoursRules } from '../form/hours.form';
import type { HoursFormValue } from '../form/hours.form.types';
import { staffScheduleTranslocoScope } from '../staff-schedule.i18n';
import type { StaffTabEditor } from './staff-hours.types';
import { WeekHoursGrid } from './week-hours-grid';

const K = 'managementStaffSchedule.hours';

/**
 * The member's week: one or more ranges per working day, beside the shop's own hours. A save
 * replaces the whole week and lists the upcoming appointments it leaves outside, without moving
 * them.
 */
@Component({
  selector: 'lib-staff-hours',
  imports: [
    Button,
    ButtonIcon,
    FormErrors,
    FormHost,
    LucideStore,
    StaffConflicts,
    TranslocoPipe,
    WeekHoursGrid,
  ],
  providers: [provideTranslocoScope(staffScheduleTranslocoScope)],
  templateUrl: './staff-hours.html',
  styleUrl: './staff-hours.scss',
})
export class StaffHours implements StaffTabEditor {
  private readonly api = inject(StaffApi);
  private readonly context = inject(STAFF_SCHEDULE_CONTEXT);
  private readonly transloco = inject(TranslocoService);
  private readonly toaster = inject(ToasterService);
  private readonly formErrors = injectFormErrors();
  private readonly injector = inject(Injector);

  readonly staffMemberId = input.required<string>();
  /** The member's saved week, ISO `dayOfWeek`, shop-local times. */
  readonly workHours = input.required<readonly StaffWorkHourViewDto[]>();
  /** The caller can change this member's hours. The host decides it from the permissions. */
  readonly editable = input(false);
  readonly language = input.required<string>();
  /** The line for a week with no hours, already translated. Empty shows the lib's own line. */
  readonly emptyText = input('');

  /** A save went through. The response holds the saved week and the conflicts. */
  readonly changed = output<StaffScheduleChangeResponse>();

  private readonly model = signal<HoursFormValue>(weekFromHours([]));

  /** What the form was loaded with, to tell a change from a row added and removed again. */
  private readonly loaded = signal<HoursFormValue>(weekFromHours([]));

  protected readonly editor = formEditor({
    model: this.model,
    rules: hoursRules,
    resetOn: () => this.staffMemberId(),
    mode: () => 'view',
    action: () => this.write(),
  });

  readonly editing = this.editor.editing;
  readonly submitting = this.editor.submitting;
  readonly canEdit = computed(() => this.editable());

  /** What the last save left uncovered. Cleared when another member opens. */
  protected readonly conflicts = linkedSignal<string, readonly StaffConflictViewDto[]>({
    source: this.staffMemberId,
    computation: () => [],
  });

  private readonly conflictsList = viewChild(StaffConflicts);

  protected readonly businessHours = this.context.businessHours;

  protected readonly interval = this.context.slotIntervalMinutes;

  /** Each day as the template draws it: its name, the shop's hours, and which ranges sit outside. */
  protected readonly days = computed(() => {
    this.language();
    const business = this.businessHours();
    return this.model().days.map((day, index) => {
      const shop = shopWindows(business, day.dayOfWeek);
      return {
        index,
        name: this.transloco.translate(`managementStaffSchedule.days.${day.dayOfWeek}`),
        shopText:
          shop.length === 0
            ? this.transloco.translate(`${K}.shopClosed`)
            : this.transloco.translate(`${K}.shop`, {
                hours: shop.map((range) => `${range.startTime}–${range.endTime}`).join(', '),
              }),
        working: day.working,
        ranges: day.ranges.map((range) => ({
          text: `${range.startTime}–${range.endTime}`,
          outside: day.working && outsideShop(range, shop),
        })),
      };
    });
  });

  protected readonly hasHours = computed(() => this.workHours().length > 0);

  constructor() {
    // The form follows the saved week while nobody edits it.
    effect(() => {
      const hours = this.workHours();
      untracked(() => {
        if (!this.editor.editing()) this.load(weekFromHours(hours));
      });
    });
  }

  hasChanges(): boolean {
    return this.editor.editing() && !sameValue(this.model(), this.loaded());
  }

  edit(): void {
    if (!this.canEdit()) return;
    this.load(weekFromHours(this.workHours()));
    this.editor.mode.set('edit');
  }

  save(): void {
    void this.editor.commit();
  }

  discard(): void {
    this.load(weekFromHours(this.workHours()));
    this.editor.mode.set('view');
  }

  protected fromShop(): void {
    this.model.set(weekFromShop(this.businessHours()));
  }

  private load(value: HoursFormValue): void {
    this.editor.reset(value);
    this.loaded.set(value);
  }

  private async write(): Promise<FormFailure | undefined> {
    const { request, refs } = hoursRequest(this.model());
    const result = await firstValueFrom(this.api.updateWorkHours(this.staffMemberId(), request));
    if (!result.isSuccess) return toFormRanges(this.formErrors(result.error), refs);

    const change = result.data;
    this.toaster.success(this.transloco.translate('managementStaffSchedule.toast.hoursUpdated'));
    this.conflicts.set(change?.conflicts ?? []);
    this.load(weekFromHours(change?.workHours ?? request.workHours));
    this.editor.mode.set('view');
    // The list renders above the week, and the Save button that had focus goes away.
    if (this.conflicts().length > 0) {
      afterNextRender(() => this.conflictsList()?.reveal(), { injector: this.injector });
    }
    if (change !== null) this.changed.emit(change);
    return undefined;
  }
}
