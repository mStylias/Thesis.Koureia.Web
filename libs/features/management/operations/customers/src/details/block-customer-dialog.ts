import { Component, effect, inject, input, model, output, signal, untracked } from '@angular/core';
import { FormField } from '@angular/forms/signals';
import { RouterLink, type UrlTree } from '@angular/router';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { firstValueFrom } from 'rxjs';
import { CustomersApi, type CustomerResponse } from '@api/customers';
import { injectFormErrors } from '@synax/forms';
import { Banner } from '@ui/banner';
import { Button, ButtonIcon } from '@ui/button';
import { Dialog, DialogFooter } from '@ui/dialog';
import { Field, FieldControl, FieldEditor, FormErrors, FormHost } from '@ui/form-field';
import { Textarea } from '@ui/textarea';
import { ToasterService } from '@ui/toaster';
import { field, fields, formEditor, type FormFailure } from '@util/forms';

import type { BlockFormValue } from './block-customer-dialog.types';

const K = 'managementCustomers.block';

/** The API's limit on a block reason. */
export const BLOCK_REASON_MAX_LENGTH = 500;

/** The reasons a click fills in, as translation keys. The owner can edit the text. */
export const BLOCK_REASON_CHOICES = ['noShows', 'lateCancellations', 'behaviour'] as const;

const BLOCK_FIELDS = fields<BlockFormValue>({
  reason: field({
    label: `${K}.reason`,
    required: `${K}.errors.reasonRequired`,
    maxLength: [BLOCK_REASON_MAX_LENGTH, `${K}.errors.reasonTooLong`],
  }),
});

/**
 * Blocks a customer from online booking at this shop, with an internal reason. Staff can still
 * book for them, and their upcoming appointments stay.
 *
 * ```html
 * <lib-block-customer-dialog [(visible)]="open" [customer]="customer" (blocked)="show($event)" />
 * ```
 */
@Component({
  selector: 'lib-block-customer-dialog',
  imports: [
    Banner,
    Button,
    ButtonIcon,
    Dialog,
    DialogFooter,
    Field,
    FieldControl,
    FieldEditor,
    FormErrors,
    FormField,
    FormHost,
    RouterLink,
    Textarea,
    TranslocoPipe,
  ],
  templateUrl: './block-customer-dialog.html',
  styleUrl: './block-customer-dialog.scss',
})
export class BlockCustomerDialog {
  private readonly api = inject(CustomersApi);
  private readonly transloco = inject(TranslocoService);
  private readonly toaster = inject(ToasterService);
  private readonly formErrors = injectFormErrors();

  readonly visible = model(false);
  readonly customer = input.required<CustomerResponse>();
  /** Where "All appointments" of the upcoming warning goes. `null` hides the link. */
  readonly appointmentsLink = input<UrlTree | null>(null);

  /** The customer as the block saved them. */
  readonly blocked = output<CustomerResponse>();

  protected readonly choices = BLOCK_REASON_CHOICES;
  protected readonly reasonMax = BLOCK_REASON_MAX_LENGTH;

  private readonly model = signal<BlockFormValue>({ reason: '' });

  protected readonly editor = formEditor({
    model: this.model,
    fields: BLOCK_FIELDS,
    action: () => this.write(),
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

  /** A quick choice fills the reason, which stays editable. */
  protected choose(choice: (typeof BLOCK_REASON_CHOICES)[number]): void {
    const reason = this.editor.form.reason();
    reason.value.set(this.transloco.translate(`${K}.choices.${choice}`));
    reason.markAsDirty();
  }

  protected save(): void {
    void this.editor.commit();
  }

  protected close(): void {
    this.visible.set(false);
  }

  private async write(): Promise<FormFailure | undefined> {
    const customer = this.customer();
    const result = await firstValueFrom(
      this.api.block(customer.id, { reason: this.model().reason.trim() }),
    );
    if (!result.isSuccess) {
      return this.formErrors(result.error, { CUSTOMER_INVALID_BLOCK_REASON: 'reason' });
    }

    // The answer's count is the one to trust: an appointment may have been booked meanwhile.
    const saved = result.data ?? customer;
    const upcoming = saved.upcomingCount;
    this.toaster.success(
      upcoming === 0
        ? this.transloco.translate(`${K}.toast`)
        : this.transloco.translate(`${K}.toastUpcoming`, { count: upcoming }),
    );
    this.blocked.emit(saved);
    this.visible.set(false);
    return undefined;
  }
}
