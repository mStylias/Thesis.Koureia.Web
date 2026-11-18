import { computed, inject, linkedSignal, Service } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { StaffApi, StaffErrorCodes, type CurrentStaffMemberResponse } from '@api/staff';
import type { StaffScheduleContext } from '@features/management-shared-staff-schedule';
import { Result } from '@synax/client/core';

/** The step of the time pickers until the record arrives. */
const DEFAULT_SLOT_INTERVAL_MINUTES = 15;

/**
 * The signed-in person's own staff record, and the shop facts the week editor reads from it.
 *
 * Provided by `ProfileWorkHours`, which also provides it as `STAFF_SCHEDULE_CONTEXT`.
 */
@Service({ autoProvided: false })
export class ProfileScheduleStore implements StaffScheduleContext {
  private readonly api = inject(StaffApi);

  private readonly resource = rxResource({ stream: () => this.api.currentMember() });

  private readonly result = computed(() =>
    this.resource.hasValue() ? this.resource.value() : undefined,
  );

  /** The own record. A failed reload keeps the last one, so a save's conflicts stay on screen. */
  readonly member = linkedSignal<
    Result<CurrentStaffMemberResponse> | undefined,
    CurrentStaffMemberResponse | null
  >({
    source: this.result,
    computation: (result, previous) =>
      result !== undefined && Result.hasData(result) ? result.data : (previous?.value ?? null),
  });

  /** The person has no active membership in any shop. */
  readonly notStaff = computed(
    () => this.result()?.error?.errorCode === StaffErrorCodes.NotStaffMember,
  );

  /** The read failed for another reason. A retry can help. */
  readonly failed = computed(
    () =>
      !this.notStaff() && (this.resource.status() === 'error' || this.result()?.isFailure === true),
  );

  readonly businessHours = computed(() => this.member()?.businessHours ?? []);

  readonly slotIntervalMinutes = computed(
    () => this.member()?.slotIntervalMinutes ?? DEFAULT_SLOT_INTERVAL_MINUTES,
  );

  /** The shop's zone. The browser's until the record arrives. */
  readonly timezone = computed(
    () => this.member()?.timezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone,
  );

  reload(): void {
    this.resource.reload();
  }
}
