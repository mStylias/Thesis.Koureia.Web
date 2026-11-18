import type { CustomerResponse } from '@api/customers';

import { customerPatch, formFromCustomer } from './customer-details.form';

const walkIn: CustomerResponse = {
  id: 'c1',
  displayName: 'Γιώργος Π.',
  firstName: 'Γιώργος',
  lastName: 'Παπάς',
  phoneNumber: '+306912345678',
  email: 'g@example.com',
  isWalkIn: true,
  visitCount: 3,
  firstVisitDate: '2026-01-10',
  lastVisitDate: '2026-09-01',
  daysSinceLastVisit: 36,
  nextAppointmentAt: null,
  upcomingCount: 0,
  noShowCount: 1,
  lastNoShowDate: '2026-05-02',
  cancellationCount: 0,
  preferredStaffMemberId: 's1',
  preferredStaffDisplayName: 'Μαρία',
  preferredStaffIsActive: true,
  customerSince: '2026-01-10',
  totalSpend: null,
  averageSpend: null,
  note: { text: 'Κοντά στα πλάγια', updatedAt: null, updatedByDisplayName: null },
  block: null,
  canEditContactDetails: true,
  canMerge: true,
};

const accountHolder: CustomerResponse = {
  ...walkIn,
  isWalkIn: false,
  canEditContactDetails: false,
  canMerge: false,
};

describe('customerPatch', () => {
  it('sends nothing when nothing changed', () => {
    expect(customerPatch(walkIn, formFromCustomer(walkIn))).toEqual({});
  });

  it('sends only the members that changed', () => {
    const value = { ...formFromCustomer(walkIn), lastName: 'Παππάς', preferredStaffMemberId: '' };

    expect(customerPatch(walkIn, value)).toEqual({
      lastName: 'Παππάς',
      preferredStaffMemberId: null,
    });
  });

  it('clears the note with an empty value', () => {
    const value = { ...formFromCustomer(walkIn), note: '  ' };

    expect(customerPatch(walkIn, value)).toEqual({ note: '' });
  });

  it('clears an emptied phone and email with null', () => {
    const value = { ...formFromCustomer(walkIn), phoneNumber: '', email: '' };

    expect(customerPatch(walkIn, value)).toEqual({ phoneNumber: null, email: null });
  });

  it("never sends an account holder's contact members", () => {
    const value = {
      ...formFromCustomer(accountHolder),
      firstName: 'Άλλο',
      email: 'other@example.com',
      note: 'Νέα σημείωση',
    };

    expect(customerPatch(accountHolder, value)).toEqual({ note: 'Νέα σημείωση' });
  });
});
