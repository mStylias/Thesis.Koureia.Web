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
import { FormField } from '@angular/forms/signals';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { LucidePencil } from '@lucide/angular';
import { firstValueFrom } from 'rxjs';
import { CompanyApi, type UpdateCompanyBookingRulesRequest } from '@api/company';
import {
  PageSection,
  registerPageEditor,
  type PageSectionEditor,
  type PageSectionState,
} from '@features/management-shared-page-sections';
import { sameValue } from '@features/management-shared-staff-schedule';
import { injectFormErrors } from '@synax/forms';
import { Button, ButtonIcon } from '@ui/button';
import { Field, FieldEditor, FieldView, FormErrors, FormHost } from '@ui/form-field';
import { Select, type SelectOption } from '@ui/select';
import { ToasterService } from '@ui/toaster';
import { formEditor, type FormFailure } from '@util/forms';

import { formatDays, formatMinutes } from '../company.format';
import { CompanyStore } from '../company.store';
import {
  BOOKING_RULES,
  BOOKING_RULES_FIELDS,
  bookingRulesForm,
  ruleChoices,
} from '../form/booking-rules.form';
import type { BookingRuleName, BookingRulesFormValue } from '../form/booking-rules.form.types';

const K = 'managementCompany.booking';

const EMPTY: BookingRulesFormValue = {
  slotIntervalMinutes: 15,
  minLeadTimeMinutes: 0,
  maxAdvanceDays: 60,
  cancellationCutoffMinutes: 0,
};

/**
 * The Booking rules card: the slot interval, the minimum notice, how far ahead customers book,
 * and the free cancellation window. Each is a choice of presets, and a stored value outside them
 * stays a choice of its own.
 */
@Component({
  selector: 'lib-company-booking-rules',
  imports: [
    Button,
    ButtonIcon,
    Field,
    FieldEditor,
    FieldView,
    FormErrors,
    FormField,
    FormHost,
    LucidePencil,
    PageSection,
    Select,
    TranslocoPipe,
  ],
  templateUrl: './company-booking-rules.html',
  styleUrl: './company-booking-rules.scss',
})
export class CompanyBookingRules implements PageSectionEditor {
  private readonly api = inject(CompanyApi);
  private readonly store = inject(CompanyStore);
  private readonly transloco = inject(TranslocoService);
  private readonly toaster = inject(ToasterService);
  private readonly formErrors = injectFormErrors();
  private readonly injector = inject(Injector);

  /** Read as an element: the ref alone gives the `libButton` component. */
  private readonly editButton = viewChild<unknown, ElementRef<HTMLButtonElement>>('editButton', {
    read: ElementRef,
  });

  protected readonly canEdit = this.store.canEdit;
  protected readonly rules = BOOKING_RULES;

  private readonly saved = computed(() => this.store.settings()?.bookingRules ?? null);

  private readonly model = signal<BookingRulesFormValue>(EMPTY);

  protected readonly editor = formEditor({
    model: this.model,
    fields: BOOKING_RULES_FIELDS,
    mode: () => 'view',
    action: () => this.write(),
  });

  protected readonly state = computed<PageSectionState>(() => {
    if (this.saved() !== null) return 'ready';
    return this.store.failed() ? 'error' : 'loading';
  });

  /** Each saved rule as the view reads it, in the page's language. */
  protected readonly sentences = computed((): Record<BookingRuleName, string> => {
    this.store.language();
    const saved = this.saved() ?? EMPTY;
    return {
      slotIntervalMinutes: this.sentence('slotIntervalMinutes', saved.slotIntervalMinutes),
      minLeadTimeMinutes: this.sentence('minLeadTimeMinutes', saved.minLeadTimeMinutes),
      maxAdvanceDays: this.sentence('maxAdvanceDays', saved.maxAdvanceDays),
      cancellationCutoffMinutes: this.sentence(
        'cancellationCutoffMinutes',
        saved.cancellationCutoffMinutes,
      ),
    };
  });

  /** The options of each select, from the values saved when the form opened. */
  protected readonly options = computed((): Record<BookingRuleName, SelectOption<number>[]> => {
    this.store.language();
    const saved = this.saved() ?? EMPTY;
    const choices = (rule: BookingRuleName): SelectOption<number>[] =>
      ruleChoices(rule, saved[rule]).map((value) => ({
        value,
        label: this.optionLabel(rule, value),
      }));
    return {
      slotIntervalMinutes: choices('slotIntervalMinutes'),
      minLeadTimeMinutes: choices('minLeadTimeMinutes'),
      maxAdvanceDays: choices('maxAdvanceDays'),
      cancellationCutoffMinutes: choices('cancellationCutoffMinutes'),
    };
  });

  constructor() {
    registerPageEditor(this);

    // The form follows the saved rules while nobody edits them.
    effect(() => {
      const rules = this.saved();
      untracked(() => {
        if (rules !== null && !this.editor.editing()) this.editor.reset(bookingRulesForm(rules));
      });
    });
  }

  hasChanges(): boolean {
    const saved = this.saved();
    return (
      this.editor.editing() && saved !== null && !sameValue(this.model(), bookingRulesForm(saved))
    );
  }

  discard(): void {
    const saved = this.saved();
    if (saved !== null) this.editor.reset(bookingRulesForm(saved));
    this.editor.mode.set('view');
  }

  protected retry(): void {
    this.store.reload();
  }

  protected edit(): void {
    const saved = this.saved();
    if (!this.canEdit() || saved === null) return;
    this.editor.reset(bookingRulesForm(saved));
    this.editor.mode.set('edit');
  }

  protected cancel(): void {
    this.discard();
    this.focusEdit();
  }

  private async write(): Promise<FormFailure | undefined> {
    const request: UpdateCompanyBookingRulesRequest = { ...this.model() };
    const result = await firstValueFrom(this.api.updateBookingRules(request));
    if (!result.isSuccess) return this.formErrors(result.error);

    const saved = result.data ?? request;
    this.store.setBookingRules(saved);
    this.editor.reset(bookingRulesForm(saved));
    this.editor.mode.set('view');
    this.focusEdit();
    this.toaster.success(this.transloco.translate(`${K}.saved`));
    return undefined;
  }

  /** `Κάθε 15 λεπτά`, `Τουλάχιστον 1 ώρα πριν`, `60 ημέρες μπροστά`, `Οποιαδήποτε στιγμή`. */
  private sentence(rule: BookingRuleName, value: number): string {
    if (value === 0 && rule === 'minLeadTimeMinutes')
      return this.transloco.translate(`${K}.noLimit`);
    if (value === 0 && rule === 'cancellationCutoffMinutes') {
      return this.transloco.translate(`${K}.anyTime`);
    }
    return this.transloco.translate(`${K}.values.${rule}`, {
      duration: this.duration(rule, value),
    });
  }

  private optionLabel(rule: BookingRuleName, value: number): string {
    if (value === 0 && rule === 'minLeadTimeMinutes')
      return this.transloco.translate(`${K}.noLimit`);
    if (value === 0 && rule === 'cancellationCutoffMinutes') {
      return this.transloco.translate(`${K}.anyTime`);
    }
    return this.duration(rule, value);
  }

  private duration(rule: BookingRuleName, value: number): string {
    const translate = this.transloco.translate.bind(this.transloco);
    return rule === 'maxAdvanceDays'
      ? formatDays(value, translate)
      : formatMinutes(value, translate);
  }

  /** The buttons that had focus go away with edit mode, so focus goes back to Edit. */
  private focusEdit(): void {
    afterNextRender(() => this.editButton()?.nativeElement.focus(), { injector: this.injector });
  }
}
