import {
  Component,
  computed,
  effect,
  inject,
  input,
  model,
  output,
  signal,
  untracked,
} from '@angular/core';
import { FormField } from '@angular/forms/signals';
import { provideTranslocoScope, TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { firstValueFrom } from 'rxjs';
import { StaffApi, type StaffScheduleChangeResponse, type StaffTimeOffResponse } from '@api/staff';
import { injectErrorMessageResolver } from '@synax/client';
import { injectFormErrors } from '@synax/forms';
import { Button } from '@ui/button';
import { DatePicker } from '@ui/date-picker';
import { Dialog, DialogFooter } from '@ui/dialog';
import { Field, FieldControl, FieldEditor, FormErrors, FormHost } from '@ui/form-field';
import { InputText } from '@ui/input-text';
import { Switch } from '@ui/switch';
import { TimePicker } from '@ui/time-picker';
import { ToasterService } from '@ui/toaster';
import { formEditor, type FormFailure } from '@util/forms';

import { STAFF_SCHEDULE_CONTEXT } from '../context/staff-schedule-context';
import {
  emptyTimeOff,
  TIME_OFF_FIELDS,
  timeOffForm,
  timeOffLiveRules,
  timeOffRequest,
  timeOffRules,
} from '../form/time-off.form';
import type { TimeOffFormValue } from '../form/time-off.form.types';
import { localParts } from '../staff-schedule.format';
import { staffScheduleTranslocoScope } from '../staff-schedule.i18n';

const K = 'managementStaffSchedule.timeOff';

/** The quick reasons, by their translation key. */
const REASONS = ['leave', 'sick', 'personal'] as const;

/**
 * Creates or edits one time off: whole days by default, or a range of hours, in the shop's zone.
 * A save reports the upcoming appointments inside it, without moving them.
 *
 * ```html
 * <lib-staff-time-off-dialog [(visible)]="open" [staffMemberId]="id" [timeOff]="null" (saved)="reload($event)" />
 * ```
 */
@Component({
  selector: 'lib-staff-time-off-dialog',
  imports: [
    Button,
    DatePicker,
    Dialog,
    DialogFooter,
    Field,
    FieldControl,
    FieldEditor,
    FormErrors,
    FormField,
    FormHost,
    InputText,
    Switch,
    TimePicker,
    TranslocoPipe,
  ],
  providers: [provideTranslocoScope(staffScheduleTranslocoScope)],
  templateUrl: './time-off-dialog.html',
  styleUrl: './time-off-dialog.scss',
})
export class TimeOffDialog {
  private readonly api = inject(StaffApi);
  private readonly context = inject(STAFF_SCHEDULE_CONTEXT);
  private readonly transloco = inject(TranslocoService);
  private readonly toaster = inject(ToasterService);
  private readonly errorMessage = injectErrorMessageResolver();
  private readonly formErrors = injectFormErrors();

  readonly visible = model(false);
  readonly staffMemberId = input.required<string>();
  /** The time off to edit, or `null` for a new one. */
  readonly timeOff = input<StaffTimeOffResponse | null>(null);
  readonly language = input.required<string>();

  /** A write went through, or the time off was gone. `null` for the latter: the list reloads. */
  readonly saved = output<StaffScheduleChangeResponse | null>();

  protected readonly reasons = REASONS;

  protected readonly interval = this.context.slotIntervalMinutes;

  protected readonly title = computed(() =>
    this.timeOff() === null ? `${K}.titleNew` : `${K}.titleEdit`,
  );

  private readonly model = signal<TimeOffFormValue>(emptyTimeOff(''));

  protected readonly editor = formEditor({
    model: this.model,
    fields: TIME_OFF_FIELDS,
    rules: timeOffRules,
    liveRules: timeOffLiveRules,
    action: () => this.write(),
  });

  constructor() {
    // Each opening starts from the time off, or from today in the shop.
    effect(() => {
      if (!this.visible()) return;
      const timeOff = this.timeOff();
      untracked(() => {
        this.editor.reset(
          timeOff === null
            ? emptyTimeOff(localParts(new Date(), this.context.timezone()).day)
            : timeOffForm(timeOff),
        );
      });
    });
  }

  protected setReason(reason: (typeof REASONS)[number]): void {
    this.editor.form.reason().value.set(this.transloco.translate(`${K}.reasons.${reason}`));
  }

  protected save(): void {
    void this.editor.commit();
  }

  protected close(): void {
    this.visible.set(false);
  }

  private async write(): Promise<FormFailure | undefined> {
    const timeOff = this.timeOff();
    const request = timeOffRequest(this.model());
    const result = await firstValueFrom(
      timeOff === null
        ? this.api.createTimeOff(this.staffMemberId(), request)
        : this.api.updateTimeOff(this.staffMemberId(), timeOff.id, request),
    );

    if (!result.isSuccess) {
      if (result.error.errorCode === 'STAFF_TIME_OFF_NOT_FOUND') {
        this.toaster.error(this.errorMessage(result.error));
        this.saved.emit(null);
        this.visible.set(false);
        return undefined;
      }
      return this.formErrors(result.error);
    }

    this.toaster.success(
      this.transloco.translate(
        `managementStaffSchedule.toast.${timeOff === null ? 'timeOffCreated' : 'timeOffUpdated'}`,
      ),
    );
    this.saved.emit(result.data);
    this.visible.set(false);
    return undefined;
  }
}
