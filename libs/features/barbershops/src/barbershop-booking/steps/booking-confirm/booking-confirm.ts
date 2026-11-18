import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  model,
  output,
} from '@angular/core';
import { TranslocoPipe, translateSignal } from '@jsverse/transloco';
import { LucideShieldCheck } from '@lucide/angular';
import type { AppointmentPriceChange } from '@api/customer-appointments';
import { Banner } from '@ui/banner';
import { Button } from '@ui/button';

import { BookingState } from '../../booking-state';
import { BookingReschedule } from '../../booking-reschedule/booking-reschedule';
import type { BookingGate } from '../../booking.types';
import { BookingConfirmFields } from './booking-confirm-fields';

/**
 * Step 5 on a wide screen: an optional phone number, the note, the policy and what the gate
 * means.
 *
 * **Wide only.** Below `lg` the page gives this step no body at all: the sheet is pinned open
 * there and holds the fields itself, beside the selection they belong to. The page decides
 * which of the two exists, so the fields are never rendered twice.
 *
 * **The button that commits is not only here.** The page's actions row holds the same one, so
 * the control the customer has pressed four times does not move for the fifth. This copy sits
 * at the end of what it commits to, for a customer who has just read the policy.
 */
@Component({
  selector: 'lib-booking-confirm',
  imports: [Banner, BookingConfirmFields, BookingReschedule, Button, TranslocoPipe],
  templateUrl: './booking-confirm.html',
  styleUrl: './booking-confirm.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BookingConfirm {
  protected readonly state = inject(BookingState);

  protected readonly shieldIcon = LucideShieldCheck;

  /** Which path the customer is on. Decided by the page, which owns the button it drives. */
  readonly gate = input.required<BookingGate>();

  /** The refusal the server gave, already translated. */
  readonly failure = input<string | null>(null);

  /** True while the appointment is being created. */
  readonly submitting = input(false);

  /** The step's own copy of the bar's action was pressed. The page decides what it means. */
  readonly commit = output();

  /** A move's total the server named after the confirmed one went stale. */
  readonly newTotal = input<AppointmentPriceChange | null>(null);

  /** The number, owned by the page so the booking can save it. Passed straight through. */
  readonly phone = model('');

  private readonly bookLabel = translateSignal('booking.confirm.book');
  private readonly moveLabel = translateSignal('booking.reschedule.confirm');
  private readonly signInLabel = translateSignal('booking.confirm.signIn');
  private readonly verifyLabel = translateSignal('booking.confirm.verify');

  /** What the action says. The same words the bar uses, for the same press. */
  protected readonly commitLabel = computed(() => {
    switch (this.gate()) {
      case 'anonymous':
        return this.signInLabel();
      case 'unverified':
        return this.verifyLabel();
      default:
        return this.state.rescheduling() === null ? this.bookLabel() : this.moveLabel();
    }
  });

  /** The free-cancellation sentence, or nothing when the shop offers no window. */
  protected readonly cancellationHours = computed(() => {
    const minutes = this.state.options()?.cancellationCutoffMinutes ?? 0;
    return minutes <= 0 ? null : Math.round((minutes / 60) * 10) / 10;
  });
}
