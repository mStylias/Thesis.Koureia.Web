import type { StaffOptionsResponse } from '@api/staff';

import { createRequest, defaultsFor } from './add-member-draft';

const OPTIONS: StaffOptionsResponse = {
  timezone: 'Europe/Athens',
  slotIntervalMinutes: 15,
  currency: 'EUR',
  businessHours: [
    { dayOfWeek: 1, openTime: '10:00', closeTime: '20:00' },
    { dayOfWeek: 6, openTime: '10:00', closeTime: '16:00' },
  ],
  jobTitles: ['barber', 'stylist', 'receptionist'],
  roles: [
    { id: 'r-admin', name: 'company_admin', isSystem: true },
    { id: 'r-staff', name: 'staff', isSystem: true },
  ],
  services: [
    {
      id: 'cut',
      name: 'Cut',
      categoryId: null,
      categoryName: null,
      price: 16,
      durationMinutes: 30,
      isActive: true,
    },
    {
      id: 'old',
      name: 'Old',
      categoryId: null,
      categoryName: null,
      price: 10,
      durationMinutes: 20,
      isActive: false,
    },
  ],
};

describe('a new member', () => {
  it('starts as a bookable barber with the staff role, the shop hours and every active service', () => {
    expect(defaultsFor(OPTIONS, true)).toEqual({
      roleId: 'r-staff',
      jobTitleCode: 'barber',
      isBookable: true,
      copyHours: true,
      allServices: true,
    });
  });

  it('sends the hours and the services the client chose, so the API invents neither', () => {
    const request = createRequest(' maria@example.com ', defaultsFor(OPTIONS, true), OPTIONS, true);

    expect(request).toEqual({
      email: 'maria@example.com',
      jobTitleCode: 'barber',
      isBookable: true,
      joinedAt: null,
      roleIds: ['r-staff'],
      services: [{ serviceId: 'cut', customPrice: null, customDurationMinutes: null }],
      workHours: [
        { dayOfWeek: 1, startTime: '10:00', endTime: '20:00' },
        { dayOfWeek: 6, startTime: '10:00', endTime: '16:00' },
      ],
    });
  });

  it('sends no hours and no services for a member who takes no appointments', () => {
    const request = createRequest(
      'maria@example.com',
      { ...defaultsFor(OPTIONS, true), isBookable: false },
      OPTIONS,
      true,
    );
    expect(request.services).toEqual([]);
    expect(request.workHours).toEqual([]);
  });

  it('sends no role from a caller who cannot assign roles', () => {
    const defaults = defaultsFor(OPTIONS, false);
    expect(defaults.roleId).toBe('');
    expect(
      createRequest('maria@example.com', { ...defaults, roleId: 'r-staff' }, OPTIONS, false)
        .roleIds,
    ).toEqual([]);
  });
});
