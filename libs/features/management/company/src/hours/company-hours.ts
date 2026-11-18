import {
  afterNextRender,
  Component,
  computed,
  effect,
  ElementRef,
  inject,
  Injector,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { LucidePencil } from '@lucide/angular';
import { firstValueFrom } from 'rxjs';
import { CompanyApi, type CompanyConflictViewDto } from '@api/company';
import { StaffAccessStore } from '@auth/data-access';
import {
  PageSection,
  registerPageEditor,
  type PageSectionEditor,
  type PageSectionState,
} from '@features/management-shared-page-sections';
import {
  sameValue,
  StaffConflicts,
  toFormRanges,
  WeekHoursGrid,
  weekFromShop,
  type HoursFormValue,
} from '@features/management-shared-staff-schedule';
import { injectFormErrors } from '@synax/forms';
import { Button, ButtonIcon } from '@ui/button';
import { ConfirmationService } from '@ui/confirmation-dialog';
import { FormErrors, FormHost } from '@ui/form-field';
import { ToasterService } from '@ui/toaster';
import { formEditor, type FormFailure } from '@util/forms';

import { CompanyStore } from '../company.store';
import {
  allClosed,
  COMPANY_FALLBACK_RANGE,
  COMPANY_MAX_RANGES,
  companyHoursRequest,
  companyHoursRules,
  rangesByDay,
} from '../form/hours.form';

const K = 'managementCompany.hours';

/** ISO weekdays, Monday first, as a Greek week reads. */
const WEEK_DAYS = [1, 2, 3, 4, 5, 6, 7] as const;

/** The staff page's address. The layout lib imports this one through the pages. */
const STAFF_PATH = '/management/staff';

/**
 * The Opening hours card: the shop's week, Monday first. Edit turns it into the week grid. A save
 * replaces the whole week, keeps every booking, and lists the ones now outside the open time.
 */
@Component({
  selector: 'lib-company-hours',
  imports: [
    Button,
    ButtonIcon,
    StaffConflicts,
    FormErrors,
    FormHost,
    LucidePencil,
    PageSection,
    RouterLink,
    TranslocoPipe,
    WeekHoursGrid,
  ],
  templateUrl: './company-hours.html',
  styleUrl: './company-hours.scss',
})
export class CompanyHours implements PageSectionEditor {
  private readonly api = inject(CompanyApi);
  private readonly store = inject(CompanyStore);
  private readonly access = inject(StaffAccessStore);
  private readonly transloco = inject(TranslocoService);
  private readonly toaster = inject(ToasterService);
  private readonly confirmation = inject(ConfirmationService);
  private readonly formErrors = injectFormErrors();
  private readonly injector = inject(Injector);

  /** Read as an element: the ref alone gives the `libButton` component. */
  private readonly editButton = viewChild<unknown, ElementRef<HTMLButtonElement>>('editButton', {
    read: ElementRef,
  });
  private readonly conflictsList = viewChild(StaffConflicts);

  protected readonly language = this.store.language;
  protected readonly canEdit = this.store.canEdit;
  protected readonly maxRanges = COMPANY_MAX_RANGES;
  protected readonly fallbackRange = COMPANY_FALLBACK_RANGE;
  protected readonly staffPath = STAFF_PATH;

  private readonly businessHours = computed(() => this.store.settings()?.businessHours ?? null);

  private readonly model = signal<HoursFormValue>(weekFromShop([]));
  /** What the form was loaded with, to tell a change from a range added and removed again. */
  private readonly loaded = signal<HoursFormValue>(weekFromShop([]));

  protected readonly editor = formEditor({
    model: this.model,
    rules: companyHoursRules,
    mode: () => 'view',
    action: () => this.write(),
  });

  /** What the last save left outside the open time. */
  protected readonly conflicts = signal<readonly CompanyConflictViewDto[]>([]);

  /** A save went through: the barbers' hours can now need the same change. */
  protected readonly saved = signal(false);

  /** The note links to the staff page only for those who can open it. */
  protected readonly canOpenStaff = computed(() => this.access.has('members:read'));

  protected readonly state = computed<PageSectionState>(() => {
    if (this.businessHours() !== null) return 'ready';
    return this.store.failed() ? 'error' : 'loading';
  });

  protected readonly empty = computed(() => (this.businessHours() ?? []).length === 0);

  /** Each day as the view reads it: its name, and its ranges or Closed. */
  protected readonly days = computed(() => {
    this.language();
    const ranges = rangesByDay(this.businessHours() ?? []);
    const closed = this.transloco.translate(`${K}.closed`);
    return WEEK_DAYS.map((dayOfWeek) => ({
      dayOfWeek,
      name: this.transloco.translate(`managementStaffSchedule.days.${dayOfWeek}`),
      text: ranges.get(dayOfWeek) ?? closed,
      open: ranges.has(dayOfWeek),
    }));
  });

  constructor() {
    registerPageEditor(this);

    // The form follows the saved week while nobody edits it.
    effect(() => {
      const hours = this.businessHours();
      untracked(() => {
        if (hours !== null && !this.editor.editing()) this.load(weekFromShop(hours));
      });
    });
  }

  hasChanges(): boolean {
    return this.editor.editing() && !sameValue(this.model(), this.loaded());
  }

  discard(): void {
    this.load(weekFromShop(this.businessHours() ?? []));
    this.editor.mode.set('view');
  }

  protected retry(): void {
    this.store.reload();
  }

  protected edit(): void {
    if (!this.canEdit()) return;
    this.load(weekFromShop(this.businessHours() ?? []));
    this.saved.set(false);
    this.editor.mode.set('edit');
  }

  protected cancel(): void {
    this.discard();
    this.focusEdit();
  }

  protected save(): void {
    void this.editor.commit();
  }

  private load(value: HoursFormValue): void {
    this.editor.reset(value);
    this.loaded.set(value);
  }

  private async write(): Promise<FormFailure | undefined> {
    if (allClosed(this.model()) && !(await this.confirmAllClosed())) return undefined;

    const { request, refs } = companyHoursRequest(this.model());
    const result = await firstValueFrom(this.api.updateHours(request));
    if (!result.isSuccess) {
      return toFormRanges(this.formErrors(result.error), refs, 'businessHours');
    }

    const change = result.data;
    const saved = change?.businessHours ?? request.businessHours.map((hour) => ({ ...hour }));
    this.store.setHours(saved);
    this.load(weekFromShop(saved));
    this.conflicts.set(change?.conflicts ?? []);
    this.saved.set(true);
    this.editor.mode.set('view');
    this.toaster.success(this.transloco.translate(`${K}.saved`));
    // The list renders above the week, and the Save button that had focus goes away.
    if (this.conflicts().length > 0) {
      afterNextRender(() => this.conflictsList()?.reveal(), { injector: this.injector });
    } else {
      this.focusEdit();
    }
    return undefined;
  }

  private async confirmAllClosed(): Promise<boolean> {
    const answer = await this.confirmation.open({
      title: this.transloco.translate(`${K}.allClosedTitle`),
      message: this.transloco.translate(`${K}.allClosedMessage`),
      confirmLabel: this.transloco.translate('managementCompany.actions.save'),
      cancelLabel: this.transloco.translate('managementCompany.actions.cancel'),
      severity: 'warning',
    });
    return answer === 'confirmed';
  }

  /** The buttons that had focus go away with edit mode, so focus goes back to Edit. */
  private focusEdit(): void {
    afterNextRender(() => this.editButton()?.nativeElement.focus(), { injector: this.injector });
  }
}
