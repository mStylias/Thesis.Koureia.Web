import {
  Component,
  computed,
  effect,
  input,
  model,
  output,
  signal,
  untracked,
} from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import type { AppointmentDetailsResponse } from '@api/appointments';
import { Button } from '@ui/button';
import { Checkbox } from '@ui/checkbox';
import { Dialog, DialogFooter } from '@ui/dialog';
import { Textarea } from '@ui/textarea';

import { REASON_MAX_LENGTH } from '../form/appointment.form';
import { formatLocalDate } from '../view/appointment-format';
import type { CancelChoice } from './cancel-appointment-dialog.types';

/**
 * "Cancel the appointment?", with an optional reason. The reason reaches the customer's email only
 * when both checkboxes say so, and the second is live only while the first is checked and there
 * is a reason to include.
 */
@Component({
  selector: 'lib-cancel-appointment-dialog',
  imports: [Button, Checkbox, Dialog, DialogFooter, Textarea, TranslocoPipe],
  templateUrl: './cancel-appointment-dialog.html',
  styleUrl: './cancel-appointment-dialog.scss',
})
export class CancelAppointmentDialog {
  readonly visible = model(false);
  readonly appointment = input.required<AppointmentDetailsResponse>();
  readonly language = input.required<string>();
  /** The cancel is in flight. */
  readonly busy = input(false);

  readonly confirmed = output<CancelChoice>();

  protected readonly reasonMaxLength = REASON_MAX_LENGTH;
  protected readonly reason = signal('');
  protected readonly notify = signal(true);
  protected readonly includeReason = signal(false);

  protected readonly hasEmail = computed(() => this.appointment().customerEmail !== null);
  protected readonly hasReason = computed(() => this.reason().trim().length > 0);
  protected readonly includeEnabled = computed(
    () => this.hasEmail() && this.notify() && this.hasReason(),
  );

  protected readonly summary = computed(() => {
    const appointment = this.appointment();
    return {
      when: `${formatLocalDate(appointment.localDate, this.language())} ${appointment.localStartTime}`,
      barber: appointment.staffDisplayName,
    };
  });

  constructor() {
    // Every open starts from nothing, so an abandoned reason is not offered to the next one.
    effect(() => {
      if (!this.visible()) return;
      untracked(() => {
        this.reason.set('');
        this.notify.set(true);
        this.includeReason.set(false);
      });
    });
  }

  protected onReason(event: Event): void {
    this.reason.set((event.target as HTMLTextAreaElement).value);
  }

  protected confirm(): void {
    if (this.busy()) return;
    const reason = this.reason().trim();
    this.confirmed.emit({
      reason: reason.length === 0 ? null : reason,
      notifyCustomer: this.hasEmail() && this.notify(),
      includeReason: this.includeEnabled() && this.includeReason(),
    });
  }
}
