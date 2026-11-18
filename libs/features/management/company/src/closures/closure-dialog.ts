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
import { FormField, readonly } from '@angular/forms/signals';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { firstValueFrom } from 'rxjs';
import {
  CompanyApi,
  type CompanyHolidayResponse,
  type CompanyScheduleChangeResponse,
} from '@api/company';
import { HOURS_MINUTE_STEP } from '@features/management-shared-staff-schedule';
import { injectErrorMessageResolver } from '@synax/client';
import { injectFormErrors } from '@synax/forms';
import { Button } from '@ui/button';
import { DatePicker, type DateRange } from '@ui/date-picker';
import { Dialog, DialogFooter } from '@ui/dialog';
import { Field, FieldControl, FieldEditor, FormErrors, FormHost } from '@ui/form-field';
import { InputText } from '@ui/input-text';
import { Switch } from '@ui/switch';
import { TimePicker } from '@ui/time-picker';
import { ToasterService } from '@ui/toaster';
import { formEditor, type FormFailure } from '@util/forms';

import { addDays } from '../company.format';
import {
  CLOSURE_FIELDS,
  closureForm,
  closureLiveRules,
  closureRequest,
  closureRules,
  emptyClosure,
  hasStarted,
} from '../form/closure.form';
import type { ClosureFormValue } from '../form/closure.form.types';

const K = 'managementCompany.closures';

/** The quick names, by their translation key. */
const NAMES = ['holiday', 'vacation', 'renovation'] as const;

/** The refusals that mean the list on screen is stale: the dialog closes and the list reloads. */
const STALE_CODES: ReadonlySet<string> = new Set([
  'COMPANY_HOLIDAY_NOT_FOUND',
  'COMPANY_HOLIDAY_ENDED',
]);

/**
 * Creates or edits one closure, or special hours that replace the week on those days. A save
 * reports the upcoming appointments it leaves outside the open time, without moving them.
 *
 * ```html
 * <lib-closure-dialog [(visible)]="open" [holiday]="null" [today]="today()" (saved)="reload($event)" />
 * ```
 */
@Component({
  selector: 'lib-closure-dialog',
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
  templateUrl: './closure-dialog.html',
  styleUrl: './closure-dialog.scss',
})
export class ClosureDialog {
  private readonly api = inject(CompanyApi);
  private readonly transloco = inject(TranslocoService);
  private readonly toaster = inject(ToasterService);
  private readonly errorMessage = injectErrorMessageResolver();
  private readonly formErrors = injectFormErrors();

  readonly visible = model(false);
  /** The closure to edit, or `null` for a new one. */
  readonly holiday = input<CompanyHolidayResponse | null>(null);
  /** Today in the shop's zone, `YYYY-MM-DD`. */
  readonly today = input.required<string>();
  readonly language = input.required<string>();

  /** A write went through, or the closure was stale. `null` for the latter: the list reloads. */
  readonly saved = output<CompanyScheduleChangeResponse | null>();

  /** The dialog is gone and the browser has put focus back on what opened it. */
  readonly closed = output();

  protected readonly names = NAMES;
  protected readonly step = HOURS_MINUTE_STEP;

  /** The closure began before today, so its first day stays as it is. */
  protected readonly started = computed(() => {
    const holiday = this.holiday();
    return holiday !== null && hasStarted(holiday, this.today());
  });

  /**
   * The days each picker refuses: before today for Από, and before Από or today for Έως. A
   * `[min]` cannot sit beside `[formField]`, and Signal Forms has no `min` for a text date.
   */
  protected readonly startsOnExcluded = computed((): readonly DateRange[] =>
    this.started() ? [] : before(this.today()),
  );

  protected readonly endsOnExcluded = computed((): readonly DateRange[] => {
    const startsOn = this.editor.form.startsOn().value();
    return before(startsOn > this.today() ? startsOn : this.today());
  });

  private readonly model = signal<ClosureFormValue>(emptyClosure(''));

  /** Από before its last change, to tell an Έως that followed it from one set on its own. */
  private previousStartsOn = '';

  protected readonly editor = formEditor({
    model: this.model,
    fields: CLOSURE_FIELDS,
    rules: (path) => {
      closureRules(path, this.today, this.started);
    },
    liveRules: (path) => {
      closureLiveRules(path);
      readonly(path.startsOn, { when: () => this.started() });
    },
    action: () => this.write(),
  });

  constructor() {
    // Each opening starts from the closure, or from today.
    effect(() => {
      if (!this.visible()) return;
      const holiday = this.holiday();
      untracked(() => {
        const value = holiday === null ? emptyClosure(this.today()) : closureForm(holiday);
        this.editor.reset(value);
        this.previousStartsOn = value.startsOn;
      });
    });
  }

  /** Έως follows Από while it equals it, and never falls behind it. */
  protected onStartsOnChange(startsOn: string): void {
    const endsOn = this.editor.form.endsOn().value;
    const follows = endsOn() === '' || endsOn() === this.previousStartsOn;
    if (startsOn !== '' && (follows || endsOn() < startsOn)) endsOn.set(startsOn);
    this.previousStartsOn = startsOn;
  }

  protected setName(name: (typeof NAMES)[number]): void {
    this.editor.form.name().value.set(this.transloco.translate(`${K}.dialog.names.${name}`));
  }

  protected save(): void {
    void this.editor.commit();
  }

  protected close(): void {
    this.visible.set(false);
  }

  private async write(): Promise<FormFailure | undefined> {
    const holiday = this.holiday();
    const request = closureRequest(this.model());
    const result = await firstValueFrom(
      holiday === null
        ? this.api.createHoliday(request)
        : this.api.updateHoliday(holiday.id, request),
    );

    if (!result.isSuccess) {
      if (STALE_CODES.has(result.error.errorCode)) {
        this.toaster.error(this.errorMessage(result.error));
        this.saved.emit(null);
        this.visible.set(false);
        return undefined;
      }
      return this.formErrors(result.error);
    }

    this.toaster.success(
      this.transloco.translate(`${K}.${holiday === null ? 'created' : 'updated'}`),
    );
    this.saved.emit(result.data);
    this.visible.set(false);
    return undefined;
  }
}

/** Every day before `day`. */
function before(day: string): readonly DateRange[] {
  return day === '' ? [] : [{ start: '0001-01-01', end: addDays(day, -1) }];
}
