import {
  afterNextRender,
  Component,
  computed,
  inject,
  Injector,
  signal,
  viewChild,
} from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { LucideCalendarPlus, LucidePencil, LucideTrash2 } from '@lucide/angular';
import { firstValueFrom } from 'rxjs';
import {
  CompanyApi,
  type CompanyConflictViewDto,
  type CompanyHolidayResponse,
  type CompanyScheduleChangeResponse,
} from '@api/company';
import {
  PageSection,
  trackPageLoading,
  type PageSectionState,
} from '@features/management-shared-page-sections';
import { StaffConflicts } from '@features/management-shared-staff-schedule';
import { injectErrorMessageResolver } from '@synax/client';
import type { Result } from '@synax/client/core';
import { Banner } from '@ui/banner';
import { Button, ButtonIcon } from '@ui/button';
import { ConfirmationService } from '@ui/confirmation-dialog';
import { ToasterService } from '@ui/toaster';
import { Tooltip } from '@ui/tooltip';

import { formatDateRange, shopToday } from '../company.format';
import { CompanyStore } from '../company.store';
import { hasStarted, inProgress } from '../form/closure.form';
import { ClosureDialog } from './closure-dialog';

const K = 'managementCompany.closures';

/** The refusals of a delete that mean the list on screen is stale. */
const STALE_CODES: ReadonlySet<string> = new Set([
  'COMPANY_HOLIDAY_NOT_FOUND',
  'COMPANY_HOLIDAY_ENDED',
]);

/**
 * The Closures and special hours card: what runs now and what is planned, soonest first. The
 * ended ones load on demand, latest first, and are history: they cannot change.
 */
@Component({
  selector: 'lib-company-closures',
  imports: [
    Banner,
    Button,
    ButtonIcon,
    ClosureDialog,
    LucideCalendarPlus,
    LucidePencil,
    LucideTrash2,
    PageSection,
    StaffConflicts,
    Tooltip,
    TranslocoPipe,
  ],
  templateUrl: './company-closures.html',
  styleUrl: './company-closures.scss',
})
export class CompanyClosures {
  private readonly api = inject(CompanyApi);
  private readonly store = inject(CompanyStore);
  private readonly transloco = inject(TranslocoService);
  private readonly toaster = inject(ToasterService);
  private readonly confirmation = inject(ConfirmationService);
  private readonly errorMessage = injectErrorMessageResolver();
  private readonly injector = inject(Injector);

  private readonly conflictsList = viewChild(StaffConflicts);

  protected readonly language = this.store.language;
  protected readonly canEdit = this.store.canEdit;

  /** Today in the shop's zone. */
  protected readonly today = computed(() => shopToday(this.store.timezone()));

  /** The person asked for the ended ones. */
  protected readonly showPast = signal(false);

  private readonly currentResource = rxResource({
    stream: () => this.api.holidays(false),
  });

  private readonly pastResource = rxResource({
    params: () => (this.showPast() ? true : undefined),
    stream: () => this.api.holidays(true),
  });

  // A write reloads in place: the lists keep their rows, and the card keeps its content and focus.
  private readonly currentResult = computed(() =>
    this.currentResource.hasValue() ? this.currentResource.value() : undefined,
  );
  private readonly pastResult = computed(() =>
    this.pastResource.hasValue() ? this.pastResource.value() : undefined,
  );

  protected readonly current = computed(() => this.rows(this.currentResult()));
  protected readonly past = computed(() => this.rows(this.pastResult()));

  protected readonly state = computed<PageSectionState>(() => {
    const result = this.currentResult();
    if (result?.isSuccess === true) return 'ready';
    if (this.currentResource.status() === 'error' || result?.isFailure === true) return 'error';
    return 'loading';
  });

  protected readonly pastLoading = this.pastResource.isLoading;
  protected readonly pastFailed = computed(
    () => this.pastResource.status() === 'error' || this.pastResult()?.isFailure === true,
  );

  protected readonly dialogOpen = signal(false);
  protected readonly editing = signal<CompanyHolidayResponse | null>(null);

  protected readonly conflicts = signal<readonly CompanyConflictViewDto[]>([]);

  constructor() {
    // The past list loads after the card, and it grows it.
    trackPageLoading(this.pastLoading);
  }

  protected retry(): void {
    this.currentResource.reload();
  }

  protected retryPast(): void {
    this.pastResource.reload();
  }

  protected togglePast(): void {
    this.showPast.update((shown) => !shown);
  }

  protected create(): void {
    if (!this.canEdit()) return;
    this.editing.set(null);
    this.dialogOpen.set(true);
  }

  protected edit(holiday: CompanyHolidayResponse): void {
    if (!this.canEdit()) return;
    this.editing.set(holiday);
    this.dialogOpen.set(true);
  }

  protected async remove(holiday: CompanyHolidayResponse, dates: string): Promise<void> {
    if (!this.canEdit()) return;
    const started = hasStarted(holiday, this.today());
    const answer = await this.confirmation.open({
      title: this.transloco.translate(`${K}.deleteTitle`),
      message: started
        ? this.transloco.translate(`${K}.deleteRunning`)
        : this.transloco.translate(`${K}.deleteMessage`, { dates }),
      confirmLabel: this.transloco.translate('managementCompany.actions.delete'),
      cancelLabel: this.transloco.translate('managementCompany.actions.cancel'),
      severity: 'warning',
    });
    if (answer !== 'confirmed') return;

    const result = await firstValueFrom(this.api.deleteHoliday(holiday.id));
    if (!result.isSuccess) {
      this.toaster.error(this.errorMessage(result.error));
      if (STALE_CODES.has(result.error.errorCode)) this.written();
      return;
    }
    this.toaster.success(this.transloco.translate(`${K}.deleted`));
    this.written();
  }

  protected onSaved(change: CompanyScheduleChangeResponse | null): void {
    this.conflicts.set(change?.conflicts ?? []);
    this.written();
  }

  // The native dialog gives focus back to Add as it closes, so the banner takes it after that.
  protected onDialogClosed(): void {
    if (this.conflicts().length === 0) return;
    afterNextRender(() => this.conflictsList()?.reveal(), { injector: this.injector });
  }

  private written(): void {
    this.currentResource.reload();
    if (this.showPast()) this.pastResource.reload();
  }

  /** Each range with its dates and its kind as one row reads them. */
  private rows(result: Result<CompanyHolidayResponse[]> | undefined): readonly {
    readonly item: CompanyHolidayResponse;
    readonly dates: string;
    readonly kind: string;
    readonly special: boolean;
    readonly inProgress: boolean;
  }[] {
    if (result?.isSuccess !== true) return [];
    const language = this.language();
    const today = this.today();
    const year = Number(today.slice(0, 4));
    return (result.data ?? []).map((item) => ({
      item,
      dates: formatDateRange(item.startsOn, item.endsOn, language, year),
      kind: item.isClosed
        ? this.transloco.translate(`${K}.closed`)
        : this.transloco.translate(`${K}.special`, {
            hours: `${item.openTime ?? ''}–${item.closeTime ?? ''}`,
          }),
      special: !item.isClosed,
      inProgress: inProgress(item, today),
    }));
  }
}
