import { COLUMN, SPEND_COLUMNS, customerColumns } from './customers.columns';
import type { CustomerColumnsDeps } from './customers.columns.types';

const deps = (overrides: Partial<CustomerColumnsDeps> = {}): CustomerColumnsDeps => ({
  translate: (key, params) => (params === undefined ? key : `${key} ${JSON.stringify(params)}`),
  language: 'el',
  timezone: 'Europe/Athens',
  staff: [
    { id: 's1', displayName: 'Μαρία', isActive: true },
    { id: 's2', displayName: 'Νίκος', isActive: false },
  ],
  canSeeSpend: true,
  ...overrides,
});

describe('customerColumns', () => {
  it('leaves the spend columns out without analytics:read, so nothing can offer them', () => {
    const ids = customerColumns(deps({ canSeeSpend: false })).map((column) => column.id);

    for (const spend of SPEND_COLUMNS) {
      expect(ids).not.toContain(spend);
    }
  });

  it('has the spend columns with the right', () => {
    const ids = customerColumns(deps()).map((column) => column.id);

    expect(ids).toEqual(expect.arrayContaining([...SPEND_COLUMNS]));
  });

  it('filters the preferred barber by id, inactive barbers marked, with "No preference"', () => {
    const barber = customerColumns(deps()).find((column) => column.id === COLUMN.preferredBarber);
    const options = barber?.filter?.headerFilterOptions ?? [];

    expect(options.map((option) => option.label)).toEqual([
      'Μαρία',
      'managementCustomers.inactiveBarber {"name":"Νίκος"}',
      'managementCustomers.noPreference',
    ]);
    expect(options[0]?.node).toEqual({ field: 'preferredStaffMemberId', op: 'eq', value: 's1' });
    expect(options[2]?.node).toEqual({ field: 'preferredStaffMemberId', op: 'isNull' });
  });

  it('writes a shop-local day without moving it to another zone', () => {
    const lastVisit = customerColumns(deps()).find((column) => column.id === COLUMN.lastVisit);
    const format = lastVisit?.format;

    expect(typeof format === 'function' ? format('2026-09-24') : '').toContain('24');
  });
});
