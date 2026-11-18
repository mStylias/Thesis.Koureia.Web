import {
  afterNextRender,
  Component,
  computed,
  ElementRef,
  inject,
  Injector,
  viewChild,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { LucideCalendarPlus, LucidePencil } from '@lucide/angular';
import { StaffAccessStore } from '@auth/data-access';
import type { StaffScheduleChangeResponse } from '@api/staff';
import {
  STAFF_SCHEDULE_CONTEXT,
  StaffHours,
  StaffTimeOff,
} from '@features/management-shared-staff-schedule';
import { SYNAX_ERROR_MESSAGES } from '@synax/client';
import { Button, ButtonIcon } from '@ui/button';
import {
  PageSection,
  registerPageEditor,
  trackPageLoading,
} from '@features/management-shared-page-sections';
import type {
  PageSectionEditor,
  PageSectionState,
} from '@features/management-shared-page-sections';

import { ProfileScheduleStore } from './profile-schedule.store';
import { workHoursErrorMessages } from './profile-work-hours.errors';

const K = 'managementProfile.workHours';

/**
 * The Work hours card: the person's own week and, with a time-off code, their own time off.
 *
 * Hidden for a person with no staff membership, and for a member who takes no online bookings.
 */
@Component({
  selector: 'lib-profile-work-hours',
  imports: [
    Button,
    ButtonIcon,
    LucideCalendarPlus,
    LucidePencil,
    PageSection,
    StaffHours,
    StaffTimeOff,
    TranslocoPipe,
  ],
  providers: [
    ProfileScheduleStore,
    { provide: STAFF_SCHEDULE_CONTEXT, useExisting: ProfileScheduleStore },
    { provide: SYNAX_ERROR_MESSAGES, useFactory: workHoursErrorMessages },
  ],
  templateUrl: './profile-work-hours.html',
  styleUrl: './profile-work-hours.scss',
  host: { '[attr.hidden]': 'hidden() ? "" : null' },
})
export class ProfileWorkHours implements PageSectionEditor {
  private readonly store = inject(ProfileScheduleStore);
  private readonly access = inject(StaffAccessStore);
  private readonly transloco = inject(TranslocoService);
  private readonly injector = inject(Injector);

  private readonly hours = viewChild(StaffHours);
  private readonly timeOff = viewChild(StaffTimeOff);
  /** Read as an element: the ref alone gives the `libButton` component. */
  private readonly editButton = viewChild<unknown, ElementRef<HTMLButtonElement>>('editButton', {
    read: ElementRef,
  });

  protected readonly language = toSignal(this.transloco.langChanges$, {
    initialValue: this.transloco.getActiveLang(),
  });

  protected readonly member = this.store.member;

  protected readonly hidden = computed(
    () => this.store.notStaff() || this.member()?.isBookable === false,
  );

  protected readonly state = computed<PageSectionState>(() => {
    if (this.member() !== null) return 'ready';
    return this.store.failed() ? 'error' : 'loading';
  });

  /**
   * The record belongs to the shop the workspace has open. The record answers for the caller's
   * membership in any shop, and the writes go to the open one. A platform admin can have them
   * differ, so the card then offers no edits.
   */
  private readonly inOpenShop = computed(() => {
    const member = this.member();
    return member !== null && member.companyId === this.access.company()?.id;
  });

  protected readonly canEditHours = computed(
    () =>
      this.inOpenShop() &&
      (this.access.has('staff:manage_schedule') || this.access.has('staff:manage_own_schedule')),
  );

  protected readonly canManageTimeOff = computed(
    () =>
      this.inOpenShop() &&
      (this.access.has('staff:manage_timeoff') || this.access.has('staff:manage_own_timeoff')),
  );

  protected readonly editing = computed(() => this.hours()?.editing() ?? false);
  protected readonly submitting = computed(() => this.hours()?.submitting() ?? false);

  /** Who sets the hours, and the shop's zone when it is not the browser's. */
  protected readonly hint = computed(() => {
    this.language();
    const parts: string[] = [];
    if (!this.canEditHours()) parts.push(this.transloco.translate(`${K}.readOnly`));
    const zone = this.member()?.timezone;
    if (zone !== undefined && zoneDiffers(zone)) {
      parts.push(this.transloco.translate(`${K}.zone`, { zone }));
    }
    return parts.join(' ');
  });

  constructor() {
    registerPageEditor(this);
    // The time-off lists load after the card, and they grow it.
    trackPageLoading(computed(() => this.timeOff()?.loading() ?? false));
  }

  hasChanges(): boolean {
    return this.hours()?.hasChanges() ?? false;
  }

  discard(): void {
    this.hours()?.discard();
  }

  protected retry(): void {
    this.store.reload();
  }

  protected edit(): void {
    this.hours()?.edit();
  }

  protected cancel(): void {
    this.discard();
    this.focusEdit();
  }

  protected save(): void {
    this.hours()?.save();
  }

  protected addTimeOff(): void {
    this.timeOff()?.create();
  }

  /**
   * The editor shows the saved week. The record is read again so the card agrees with it. The
   * editor moves focus to the conflicts list when there is one.
   */
  protected onHoursChanged(change: StaffScheduleChangeResponse): void {
    this.store.reload();
    if (change.conflicts.length === 0) this.focusEdit();
  }

  /** The buttons that had focus go away with edit mode, so focus goes back to Edit. */
  private focusEdit(): void {
    afterNextRender(() => this.editButton()?.nativeElement.focus(), { injector: this.injector });
  }
}

function zoneDiffers(zone: string): boolean {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone !== zone;
  } catch {
    return false;
  }
}
