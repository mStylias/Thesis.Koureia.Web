import type { AppointmentDetailsResponse } from '@api/appointments';

import { emptyAppointmentForm } from './appointment.form';
import {
  createRequest,
  customerEmail,
  customerVisibleChange,
  formFromAppointment,
  formFromPrefill,
  updateRequest,
} from './appointment-requests';

const BOOKED: AppointmentDetailsResponse = {
  id: 'a1',
  staffMemberId: 'nikos',
  staffDisplayName: 'Nikos P.',
  customerId: 'c1',
  customerDisplayName: 'Giorgos Papas',
  customerEmail: 'giorgos@example.com',
  customerPhoneNumber: '+306900000000',
  localDate: '2026-09-24',
  localStartTime: '10:00',
  localEndTime: '10:30',
  status: 'confirmed',
  notes: 'Short on the sides',
  internalNotes: null,
  totalPrice: 15,
  currency: 'EUR',
  createdAt: '2026-09-20T08:00:00+00:00',
  cancellationReason: null,
  cancelledAt: null,
  cancelledByDisplayName: null,
  services: [{ serviceId: 'cut', name: 'Cut', categoryId: 'hair', durationMinutes: 30, price: 15 }],
  durationOverridden: false,
  source: 'staff',
  createdByDisplayName: 'Maria K.',
  updatedAt: null,
  modifiedByDisplayName: null,
  customerHasAccount: true,
  customerNote: null,
  customerPreferredStaffMemberId: null,
  customerPreferredStaffDisplayName: null,
  customerPreferredStaffIsActive: null,
  customerNoShowCount: 0,
  customerBlock: null,
};

describe('formFromAppointment', () => {
  it('opens an edit on what the appointment holds', () => {
    expect(formFromAppointment(BOOKED)).toMatchObject({
      customerId: 'c1',
      serviceIds: ['cut'],
      staffMemberId: 'nikos',
      localDate: '2026-09-24',
      localStartTime: '10:00',
      localEndTime: '10:30',
      endOverridden: false,
      internalNotes: '',
    });
  });
});

describe('formFromPrefill', () => {
  it('takes the slot the create was started from', () => {
    expect(
      formFromPrefill(
        { localDate: '2026-09-25', localStartTime: '11:00', staffMemberId: 'maria' },
        null,
      ),
    ).toMatchObject({
      localDate: '2026-09-25',
      localStartTime: '11:00',
      staffMemberId: 'maria',
      serviceIds: [],
      customerId: '',
    });
  });

  it('copies the customer, the barber and the services for "Book again", and no time', () => {
    expect(formFromPrefill({ localDate: '2026-10-01', rebookId: 'a1' }, BOOKED)).toMatchObject({
      customerId: 'c1',
      staffMemberId: 'nikos',
      serviceIds: ['cut'],
      localDate: '2026-10-01',
      localStartTime: '',
    });
  });
});

describe('customerEmail', () => {
  it('reads a walk-in email from the form and an existing one from the pick', () => {
    const walkIn = {
      ...emptyAppointmentForm(),
      customerMode: 'new' as const,
      newCustomer: { firstName: 'Nikos', lastName: '', phoneNumber: '', email: '  n@example.com ' },
    };

    expect(customerEmail(walkIn, 'ignored@example.com')).toBe('n@example.com');
    expect(customerEmail(emptyAppointmentForm(), 'giorgos@example.com')).toBe(
      'giorgos@example.com',
    );
    expect(customerEmail(emptyAppointmentForm(), null)).toBeNull();
  });
});

describe('createRequest', () => {
  const filled = {
    ...emptyAppointmentForm(),
    customerId: 'c1',
    serviceIds: ['cut'],
    staffMemberId: 'nikos',
    localDate: '2026-09-24',
    localStartTime: '10:00',
    localEndTime: '10:30',
    internalNotes: '  ',
  };

  it('books an existing customer with a computed end', () => {
    expect(createRequest(filled, true)).toEqual({
      customerId: 'c1',
      newCustomer: null,
      staffMemberId: 'nikos',
      serviceIds: ['cut'],
      localDate: '2026-09-24',
      localStartTime: '10:00',
      localEndTime: null,
      internalNotes: null,
      notifyCustomer: true,
    });
  });

  it('sends the end only when it is overridden', () => {
    expect(
      createRequest({ ...filled, endOverridden: true, localEndTime: '11:00' }, true).localEndTime,
    ).toBe('11:00');
  });

  it('creates a walk-in with the blanks as null', () => {
    const request = createRequest(
      {
        ...filled,
        customerMode: 'new',
        newCustomer: { firstName: ' Nikos ', lastName: '', phoneNumber: '', email: '' },
      },
      false,
    );

    expect(request.customerId).toBeNull();
    expect(request.newCustomer).toEqual({
      firstName: 'Nikos',
      lastName: null,
      phoneNumber: null,
      email: null,
    });
  });

  it('notifies nobody without an email, whatever the checkbox says', () => {
    expect(createRequest(filled, false).notifyCustomer).toBe(false);
  });
});

describe('updateRequest', () => {
  const unchanged = formFromAppointment(BOOKED);

  it('sends nothing but the notify flag when nothing changed', () => {
    expect(updateRequest(unchanged, BOOKED, false, true)).toEqual({ notifyCustomer: false });
  });

  it('sends start and end together, and emails on a change the customer sees', () => {
    const request = updateRequest({ ...unchanged, localStartTime: '11:00' }, BOOKED, false, true);

    expect(request).toEqual({ localStartTime: '11:00', localEndTime: null, notifyCustomer: true });
  });

  it('sends a reset of the override as a null end', () => {
    const overridden = { ...BOOKED, durationOverridden: true, localEndTime: '11:00' };
    const request = updateRequest(formFromAppointment({ ...overridden }), overridden, false, true);
    expect(request).toEqual({ notifyCustomer: false });

    const reset = updateRequest(
      { ...formFromAppointment(overridden), endOverridden: false },
      overridden,
      false,
      true,
    );
    expect(reset).toMatchObject({ localStartTime: '10:00', localEndTime: null });
  });

  it('never emails about the internal note', () => {
    const request = updateRequest({ ...unchanged, internalNotes: 'VIP' }, BOOKED, false, true);

    expect(request).toEqual({ internalNotes: 'VIP', notifyCustomer: false });
    expect(customerVisibleChange({ ...unchanged, internalNotes: 'VIP' }, BOOKED)).toBe(false);
  });

  it('sends the note alone for a terminal appointment', () => {
    const request = updateRequest(
      { ...unchanged, internalNotes: 'Paid cash', localStartTime: '12:00' },
      BOOKED,
      true,
      true,
    );

    expect(request).toEqual({ internalNotes: 'Paid cash', notifyCustomer: false });
  });

  it('counts a new order of the same services as a change', () => {
    const twice = {
      ...BOOKED,
      services: [...BOOKED.services, { ...BOOKED.services[0], serviceId: 'beard', name: 'Beard' }],
    };
    const request = updateRequest(
      { ...formFromAppointment(twice), serviceIds: ['beard', 'cut'] },
      twice,
      false,
      true,
    );

    expect(request.serviceIds).toEqual(['beard', 'cut']);
  });
});
