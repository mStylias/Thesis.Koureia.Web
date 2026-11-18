import type { StaffOptionsResponse } from '@api/staff';

import { serviceGroups, servicesForm, servicesRequest, toFormRows } from './services-draft';

const OPTIONS: StaffOptionsResponse = {
  timezone: 'Europe/Athens',
  slotIntervalMinutes: 15,
  currency: 'EUR',
  businessHours: [],
  jobTitles: ['barber'],
  roles: [],
  services: [
    {
      id: 'cut',
      name: 'Cut',
      categoryId: 'hair',
      categoryName: 'Hair',
      price: 16,
      durationMinutes: 30,
      isActive: true,
    },
    {
      id: 'old',
      name: 'Old',
      categoryId: 'hair',
      categoryName: 'Hair',
      price: 10,
      durationMinutes: 20,
      isActive: false,
    },
    {
      id: 'gone',
      name: 'Gone',
      categoryId: null,
      categoryName: null,
      price: 5,
      durationMinutes: 10,
      isActive: false,
    },
    {
      id: 'beard',
      name: 'Beard',
      categoryId: null,
      categoryName: null,
      price: 12,
      durationMinutes: 20,
      isActive: true,
    },
  ],
};

describe('the services draft', () => {
  it('offers every active service and any inactive one the member has, so a save keeps it', () => {
    const form = servicesForm(
      [{ serviceId: 'old', customPrice: 9, customDurationMinutes: null }],
      OPTIONS,
    );

    expect(form.rows.map((row) => row.serviceId)).toEqual(['cut', 'old', 'beard']);
    expect(form.rows.find((row) => row.serviceId === 'old')).toEqual({
      serviceId: 'old',
      selected: true,
      customPrice: 9,
      customDurationMinutes: null,
    });
  });

  it('groups the rows by category, the uncategorized under their own name', () => {
    const groups = serviceGroups(servicesForm([], OPTIONS), OPTIONS, 'Uncategorized');
    expect(groups.map((group) => [group.name, group.rows.map((row) => row.serviceId)])).toEqual([
      ['Hair', ['cut']],
      ['Uncategorized', ['beard']],
    ]);
  });

  it('sends only the selected rows, an empty own value as null, and maps refusals back', () => {
    const form = servicesForm([], OPTIONS);
    form.rows[2] = {
      serviceId: 'beard',
      selected: true,
      customPrice: null,
      customDurationMinutes: 25,
    };

    const { request, rows } = servicesRequest(form);
    expect(request.services).toEqual([
      { serviceId: 'beard', customPrice: null, customDurationMinutes: 25 },
    ]);

    const failure = toFormRows(
      {
        errors: [
          {
            code: 'SERVICE_INVALID_DURATION',
            message: 'bad',
            path: ['services', 0, 'customDurationMinutes'],
          },
        ],
      },
      rows,
    );
    expect(failure.errors[0]?.path).toEqual(['rows', 2, 'customDurationMinutes']);
  });
});
