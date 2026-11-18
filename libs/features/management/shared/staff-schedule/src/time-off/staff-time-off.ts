import { Component, computed, inject, input, linkedSignal, output, signal } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { provideTranslocoScope, TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { LucidePencil, LucideTrash2 } from '@lucide/angular';
import { firstValueFrom } from 'rxjs';
import {
  StaffApi,
  type StaffConflictViewDto,
  type StaffScheduleChangeResponse,
  type StaffTimeOffResponse,
} from '@api/staff';
import { injectErrorMessageResolver } from '@synax/client';
import type { Result } from '@synax/client/core';
import { Banner } from '@ui/banner';
import { Button } from '@ui/button';
import { ConfirmationService } from '@ui/confirmation-dialog';
import { ToasterService } from '@ui/toaster';
import { Tooltip } from '@ui/tooltip';

import { StaffConflicts } from '../conflicts/staff-conflicts';
import { formatSpan } from '../staff-schedule.format';
import { staffScheduleTranslocoScope } from '../staff-schedule.i18n';
import { TimeOffDialog } from './time-off-dialog';

const K = 'managementStaffSchedule.timeOff';

/**
 * The member's time off: what runs now and what is planned, then what has ended. The host opens a
 * new one through {@link create}.
 */
@Component({
  selector: 'lib-staff-time-off',
  imports: [
    Banner,
    Button,
    LucidePencil,
    LucideTrash2,
    StaffConflicts,
    TimeOffDialog,
    Tooltip,
    TranslocoPipe,
  ],
  providers: [provideTranslocoScope(staffScheduleTranslocoScope)],
  templateUrl: './staff-time-off.html',
  styleUrl: './staff-time-off.scss',
})
export class StaffTimeOff {
  private readonly api = inject(StaffApi);
  private readonly transloco = inject(TranslocoService);
  private readonly toaster = inject(ToasterService);
  private readonly confirmation = inject(ConfirmationService);
  private readonly errorMessage = injectErrorMessageResolver();

  readonly staffMemberId = input.required<string>();
  /** The caller can change this member's time off. */
  readonly editable = input(false);
  readonly language = input.required<string>();
  /** The level of the two list headings. A host that puts the lists under its own h3 passes 4. */
  readonly headingLevel = input<3 | 4>(3);

  /** A time off was written or deleted. */
  readonly changed = output();

  /** Bumped by every write, so both lists read again. */
  private readonly revision = signal(0);

  private readonly currentResource = rxResource({
    params: () => ({ id: this.staffMemberId(), revision: this.revision() }),
    stream: ({ params }) => this.api.timeOff(params.id, false),
  });

  private readonly pastResource = rxResource({
    params: () => ({ id: this.staffMemberId(), revision: this.revision() }),
    stream: ({ params }) => this.api.timeOff(params.id, true),
  });

  protected readonly current = computed(() => this.rows(this.currentResource.value()));
  protected readonly past = computed(() => this.rows(this.pastResource.value()));

  protected readonly currentFailed = computed(
    () => this.currentResource.value()?.isFailure === true,
  );
  protected readonly pastFailed = computed(() => this.pastResource.value()?.isFailure === true);
  protected readonly currentLoading = this.currentResource.isLoading;
  protected readonly pastLoading = this.pastResource.isLoading;

  /** A list is still loading, so the panel can still grow. */
  readonly loading = computed(() => this.currentLoading() || this.pastLoading());

  protected readonly dialogOpen = signal(false);
  protected readonly editing = signal<StaffTimeOffResponse | null>(null);

  protected readonly conflicts = linkedSignal<string, readonly StaffConflictViewDto[]>({
    source: this.staffMemberId,
    computation: () => [],
  });

  /** Opens the dialog on a new time off. */
  create(): void {
    if (!this.editable()) return;
    this.editing.set(null);
    this.dialogOpen.set(true);
  }

  protected edit(timeOff: StaffTimeOffResponse): void {
    this.editing.set(timeOff);
    this.dialogOpen.set(true);
  }

  protected retry(): void {
    this.currentResource.reload();
    this.pastResource.reload();
  }

  protected async remove(timeOff: StaffTimeOffResponse, dates: string): Promise<void> {
    const answer = await this.confirmation.open({
      title: this.transloco.translate(`${K}.deleteTitle`),
      message: this.transloco.translate(`${K}.deleteMessage`, { dates }),
      confirmLabel: this.transloco.translate(`${K}.deleteConfirm`),
      cancelLabel: this.transloco.translate(`${K}.deleteCancel`),
      severity: 'warning',
    });
    if (answer !== 'confirmed') return;
    const result = await firstValueFrom(this.api.deleteTimeOff(this.staffMemberId(), timeOff.id));
    if (!result.isSuccess && result.error.errorCode !== 'STAFF_TIME_OFF_NOT_FOUND') {
      this.toaster.error(this.errorMessage(result.error));
      return;
    }
    this.toaster.success(this.transloco.translate('managementStaffSchedule.toast.timeOffDeleted'));
    this.written();
  }

  protected onSaved(change: StaffScheduleChangeResponse | null): void {
    this.conflicts.set(change?.conflicts ?? []);
    this.written();
  }

  private written(): void {
    this.revision.update((value) => value + 1);
    this.changed.emit();
  }

  /** Each time off with its dates and hours as one line reads them. */
  private rows(result: Result<StaffTimeOffResponse[]> | undefined): readonly {
    readonly item: StaffTimeOffResponse;
    readonly dates: string;
    readonly hours: string;
  }[] {
    if (result?.isSuccess !== true) return [];
    const language = this.language();
    const wholeDay = this.transloco.translate(`${K}.wholeDay`);
    return (result.data ?? []).map((item) => ({
      item,
      dates: formatSpan(item.startsOn, item.endsOn, language),
      hours:
        item.startTime === null || item.endTime === null
          ? wholeDay
          : `${item.startTime}–${item.endTime}`,
    }));
  }
}
