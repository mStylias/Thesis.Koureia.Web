import { Location } from '@angular/common';
import { provideLocationMocks } from '@angular/common/testing';
import { TestBed } from '@angular/core/testing';

import { BookingHistory } from './booking-history';
import type { BookingStepId } from './booking.types';

describe('BookingHistory', () => {
  let history: BookingHistory;
  let location: Location;
  let restored: BookingStepId[];

  beforeEach(() => {
    restored = [];
    TestBed.configureTestingModule({ providers: [provideLocationMocks()] });
    location = TestBed.inject(Location);
    history = TestBed.inject(BookingHistory);
  });

  function start(step: BookingStepId = 'services'): void {
    history.start(step, (next) => restored.push(next));
  }

  it('walks back one section at a time and then leaves the page', () => {
    start();
    history.push('barber');
    history.push('when');
    history.push('confirm');

    location.back();
    location.back();
    location.back();

    expect(restored).toEqual(['when', 'barber', 'services']);
    expect(history.atStart()).toBe(true);

    // One more, and the browser leaves the page rather than moving a step. Nothing of ours is
    // on the entry it lands on, so nothing is restored.
    location.back();
    expect(restored).toHaveLength(3);
  });

  it('goes forward again', () => {
    start();
    history.push('barber');

    location.back();
    location.forward();

    expect(restored.at(-1)).toBe('barber');
  });

  it('drops the forward branch when the flow moves on after going back', () => {
    start();
    history.push('barber');
    history.push('when');

    location.back();
    history.push('confirm');
    location.back();

    // `when` was ahead of where the customer stood and is gone. Back from `confirm` lands on
    // the step it was pushed from.
    expect(restored.at(-1)).toBe('barber');
  });

  it('ignores a history entry it did not write', () => {
    start();
    history.push('barber');

    // Another feature's entry, at the same address.
    location.go(location.path(true), '', { somethingElse: 1 });
    location.back();
    restored = [];

    location.forward();

    expect(restored).toEqual([]);
  });

  it('never changes the address', () => {
    const before = location.path(true);
    start();
    history.push('barber');

    expect(location.path(true)).toBe(before);
  });

  it('seeds a fresh stack when the flow restarts', () => {
    start();
    history.push('barber');

    start('services');

    expect(history.atStart()).toBe(true);
  });
});
