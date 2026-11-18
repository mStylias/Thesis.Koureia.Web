import { ChangeDetectionStrategy, Component, computed, inject, input, model } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { TranslocoPipe } from '@jsverse/transloco';
import { UserProfileApi } from '@api/users';
import { PhoneInput } from '@ui/phone-input';
import { Textarea } from '@ui/textarea';

import { BookingState } from '../../booking-state';
import type { BookingGate } from '../../booking.types';

/** How long a note the barber will actually read. */
const NOTE_MAX_LENGTH = 400;

let nextUniqueId = 0;

/**
 * The two things the confirm step asks for: an optional number and a note for the barber.
 *
 * Its own component because the two surfaces that ask are different components. On a wide
 * screen the confirm step holds them; on a narrow one the step has no body at all and the
 * page puts them in the sheet, beside the selection they belong to.
 *
 * **Exactly one instance exists at a time.** The page renders whichever surface the width
 * calls for, so the profile is read once and there is never a second textarea holding the
 * same note.
 */
@Component({
  selector: 'lib-booking-confirm-fields',
  imports: [PhoneInput, Textarea, TranslocoPipe],
  templateUrl: './booking-confirm-fields.html',
  styleUrl: './booking-confirm-fields.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BookingConfirmFields {
  protected readonly state = inject(BookingState);
  private readonly profiles = inject(UserProfileApi);

  /** Which path the customer is on. Decides whether the number is worth asking for. */
  readonly gate = input.required<BookingGate>();

  /**
   * The number, owned by the page so the booking can save it.
   *
   * Deliberately not part of the draft: a draft is written to `localStorage`, and a phone
   * number is not something to leave on a shared device for six hours.
   */
  readonly phone = model('');

  protected readonly noteMaxLength = NOTE_MAX_LENGTH;
  protected readonly phoneWhyId = `booking-confirm-phone-why-${nextUniqueId++}`;
  protected readonly noteCountId = `booking-confirm-note-count-${nextUniqueId++}`;

  private readonly profileResource = rxResource({
    params: () => (this.gate() === 'ready' ? {} : undefined),
    stream: () => this.profiles.current(),
  });

  /**
   * Offered only to someone signed in whose profile has no number yet.
   *
   * The field is withheld while the gate is anything else: an anonymous customer has no
   * profile to write to, and asking before sign-in loses whatever they typed.
   */
  protected readonly needsPhone = computed(() => {
    const profile = this.profileResource.value();
    return profile !== undefined && (profile.phoneNumber === null || profile.phoneNumber === '');
  });

  protected onNotesInput(value: string): void {
    this.state.setNotes(value.slice(0, NOTE_MAX_LENGTH));
  }
}
