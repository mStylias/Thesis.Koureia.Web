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
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import {
  CustomerAppointmentErrorCodes,
  CustomerAppointmentsApi,
  type AppointmentResponse,
} from '@api/customer-appointments';
import { injectFormErrors } from '@synax/forms';
import { Button } from '@ui/button';
import { Dialog, DialogFooter } from '@ui/dialog';
import { Field, FieldControl, FieldEditor, FormErrors, FormHost } from '@ui/form-field';
import { Textarea } from '@ui/textarea';
import { ToasterService } from '@ui/toaster';
import { formatShopDate } from '@util/booking-format';
import { field, fields, formEditor, type FormFailure } from '@util/forms';
import { ActiveLanguage } from '@util/language';
import { firstValueFrom } from 'rxjs';

import type { CancelFormValue } from '../../account.types';

const K = 'account.cancel';

/** The API's limit on a cancellation reason. */
const CANCEL_REASON_MAX_LENGTH = 500;

const CANCEL_FIELDS = fields<CancelFormValue>({
  reason: field({
    label: `${K}.reason`,
    hint: `${K}.reasonHint`,
    maxLength: CANCEL_REASON_MAX_LENGTH,
  }),
});

/** Refusals that mean the page is out of date: the window closed, or it is no longer active. */
const STALE_CODES: readonly string[] = [
  CustomerAppointmentErrorCodes.ChangeWindowClosed,
  CustomerAppointmentErrorCodes.InvalidTransition,
  CustomerAppointmentErrorCodes.NotFound,
];

/**
 * Cancels one of the customer's appointments, with an optional reason the shop sees.
 *
 * ```html
 * <lib-cancel-appointment-dialog [(visible)]="open" [appointment]="a" (cancelled)="show($event)" />
 * ```
 */
@Component({
  selector: 'lib-cancel-appointment-dialog',
  imports: [
    Button,
    Dialog,
    DialogFooter,
    Field,
    FieldControl,
    FieldEditor,
    FormErrors,
    FormField,
    FormHost,
    Textarea,
    TranslocoPipe,
  ],
  templateUrl: './cancel-appointment-dialog.html',
  styleUrl: './cancel-appointment-dialog.scss',
})
export class CancelAppointmentDialog {
  private readonly api = inject(CustomerAppointmentsApi);
  private readonly transloco = inject(TranslocoService);
  private readonly toaster = inject(ToasterService);
  private readonly language = inject(ActiveLanguage);
  private readonly formErrors = injectFormErrors();

  readonly visible = model(false);
  readonly appointment = input.required<AppointmentResponse>();

  /** The appointment as the cancel saved it. */
  readonly cancelled = output<AppointmentResponse>();
  /** The appointment changed under the page, so the caller reads it again. */
  readonly stale = output();

  private readonly model = signal<CancelFormValue>({ reason: '' });

  protected readonly editor = formEditor({
    model: this.model,
    fields: CANCEL_FIELDS,
    action: () => this.write(),
  });

  protected readonly summary = computed(() => {
    const appointment = this.appointment();
    return {
      date: formatShopDate(appointment.localDate, this.language.value(), true),
      time: appointment.localTime,
      shop: appointment.companyName,
    };
  });

  constructor() {
    // Each opening starts empty.
    effect(() => {
      if (!this.visible()) return;
      untracked(() => {
        this.editor.reset({ reason: '' });
      });
    });
  }

  protected confirm(): void {
    void this.editor.commit();
  }

  protected close(): void {
    this.visible.set(false);
  }

  private async write(): Promise<FormFailure | undefined> {
    const reason = this.model().reason.trim();
    const result = await firstValueFrom(
      this.api.cancel(
        this.appointment().id,
        { reason: reason === '' ? null : reason },
        this.language.value(),
      ),
    );

    if (!result.isSuccess) {
      if (STALE_CODES.includes(result.error.errorCode)) {
        this.toaster.error(this.transloco.translate(`account.errors.${result.error.errorCode}`));
        this.visible.set(false);
        this.stale.emit();
        return undefined;
      }
      return this.formErrors(result.error, {
        [CustomerAppointmentErrorCodes.InvalidCancellationReason]: 'reason',
      });
    }

    this.toaster.success(this.transloco.translate(`${K}.done`));
    if (result.data !== null) this.cancelled.emit(result.data);
    this.visible.set(false);
    return undefined;
  }
}
