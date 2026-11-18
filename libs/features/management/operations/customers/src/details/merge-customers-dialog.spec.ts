import type { CustomerResponse } from '@api/customers';

import { NOTE_SEPARATOR, defaultChoices, joinedNote, mergeValue } from './merge-customers-dialog';

const base: CustomerResponse = {
  id: 'kept',
  displayName: 'Giorgos P.',
  firstName: 'Giorgos',
  lastName: 'Papas',
  phoneNumber: '+306911111111',
  email: null,
  isWalkIn: true,
  visitCount: 2,
  firstVisitDate: '2026-01-10',
  lastVisitDate: '2026-03-01',
  daysSinceLastVisit: 200,
  nextAppointmentAt: null,
  upcomingCount: 0,
  noShowCount: 0,
  lastNoShowDate: null,
  cancellationCount: 0,
  preferredStaffMemberId: null,
  preferredStaffDisplayName: null,
  preferredStaffIsActive: null,
  customerSince: '2026-01-10',
  totalSpend: null,
  averageSpend: null,
  note: null,
  block: null,
  canEditContactDetails: true,
  canMerge: true,
};

const other: CustomerResponse = {
  ...base,
  id: 'removed',
  displayName: 'Giorgos Pap.',
  lastName: 'Papadopoulos',
  phoneNumber: '+306922222222',
  email: 'g@example.com',
  lastVisitDate: '2026-09-01',
  preferredStaffMemberId: 's1',
  preferredStaffDisplayName: 'Maria K.',
  preferredStaffIsActive: true,
};

describe('defaultChoices', () => {
  it('takes every value from the side with the latest visit', () => {
    expect(defaultChoices(base, other)).toEqual({
      name: 'Removed',
      phone: 'Removed',
      email: 'Removed',
      preferredStaff: 'Removed',
    });
  });

  it('never lets an empty value win over a filled one', () => {
    const newerKept = { ...base, lastVisitDate: '2026-10-01' };

    expect(defaultChoices(newerKept, other)).toEqual({
      name: 'Kept',
      phone: 'Kept',
      // The kept side has no email and no preferred barber, so the other side's stay.
      email: 'Removed',
      preferredStaff: 'Removed',
    });
  });

  it('reads a side with no visit as the older one', () => {
    expect(
      defaultChoices({ ...base, lastVisitDate: null }, { ...other, lastVisitDate: null }),
    ).toEqual({ name: 'Kept', phone: 'Kept', email: 'Removed', preferredStaff: 'Removed' });
  });
});

describe('joinedNote', () => {
  it('puts the kept note first, then the line, then the other one', () => {
    const kept = { ...base, note: { text: 'Short', updatedAt: null, updatedByDisplayName: null } };
    const removed = {
      ...other,
      note: { text: 'Beard', updatedAt: null, updatedByDisplayName: null },
    };

    expect(joinedNote(kept, removed)).toBe(`Short\n${NOTE_SEPARATOR}\nBeard`);
  });

  it('adds nothing for a side with no note', () => {
    const removed = {
      ...other,
      note: { text: 'Beard', updatedAt: null, updatedByDisplayName: null },
    };

    expect(joinedNote(base, removed)).toBe('Beard');
    expect(joinedNote(base, other)).toBe('');
  });
});

describe('mergeValue', () => {
  it('shows the first and last name together', () => {
    expect(mergeValue(other, 'name')).toBe('Giorgos Papadopoulos');
  });
});
