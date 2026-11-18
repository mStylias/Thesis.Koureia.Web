import { isPlatformBrowser } from '@angular/common';
import { PLATFORM_ID, Service, computed, inject, signal } from '@angular/core';
import { TranslocoService } from '@jsverse/transloco';
import { firstValueFrom } from 'rxjs';
import { StaffApi, type StaffMemberCardResponse, type StaffOptionsResponse } from '@api/staff';
import type { StaffScheduleContext } from '@features/management-shared-staff-schedule';

/**
 * How long the first-load skeleton stays up at minimum. The same floor as the datagrid's, so a
 * fast answer does not flash the shape for one frame.
 */
export const SKELETON_MIN_DURATION = 200;

/**
 * What the cards, the add dialog and the drawer over them share.
 *
 * `autoProvided: false` and provided by `StaffList`, so each visit starts a new store. The drawer,
 * a child route in the page's outlet, reads the same one. It is also the drawer's
 * `STAFF_SCHEDULE_CONTEXT`.
 */
@Service({ autoProvided: false })
export class StaffStore implements StaffScheduleContext {
  private readonly api = inject(StaffApi);
  private readonly transloco = inject(TranslocoService);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  /** `staff/options`. `null` until read, or on a failure. */
  readonly options = signal<StaffOptionsResponse | null>(null);

  /** The last read of the options failed. The tabs that need them offer a retry. */
  readonly optionsFailed = signal(false);

  /** Every member, inactive ones included. `null` until the first read lands. */
  readonly members = signal<readonly StaffMemberCardResponse[] | null>(null);

  readonly membersLoading = signal(false);

  /** The last read of the list failed. A list already on screen stays. */
  readonly membersFailed = signal(false);

  readonly currency = computed(() => this.options()?.currency ?? 'EUR');

  /** The shop's opening hours. Empty until the options land. */
  readonly businessHours = computed(() => this.options()?.businessHours ?? []);

  /** The time pickers' step. 15 minutes until the options land. */
  readonly slotIntervalMinutes = computed(() => this.options()?.slotIntervalMinutes ?? 15);

  /** The shop's zone. The browser's until the options land. */
  readonly timezone = computed(
    () => this.options()?.timezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone,
  );

  /** Reads the options. A failure leaves `null`: the cards still render. */
  async loadOptions(): Promise<void> {
    this.optionsFailed.set(false);
    const result = await firstValueFrom(this.api.options(this.transloco.getActiveLang()));
    this.options.set(result.isSuccess ? (result.data ?? null) : null);
    this.optionsFailed.set(!result.isSuccess);
  }

  /**
   * Reads the cards again. A write in the drawer and the refresh button both call it. The first
   * read commits no sooner than {@link SKELETON_MIN_DURATION}, in the browser only: a server
   * render is one shot, and the floor could only hold the response back.
   */
  async reload(): Promise<void> {
    this.membersLoading.set(true);
    const floor =
      this.isBrowser && this.members() === null
        ? new Promise((resolve) => setTimeout(resolve, SKELETON_MIN_DURATION))
        : null;
    const result = await firstValueFrom(this.api.list());
    await floor;
    this.membersLoading.set(false);
    this.membersFailed.set(!result.isSuccess);
    if (result.isSuccess) this.members.set(result.data ?? []);
  }
}
