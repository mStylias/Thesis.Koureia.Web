import type { GridState } from '@ui/datagrid';

import { customerViewState } from './customer-view';

const CUSTOMER = 'c0ffee00-0000-4000-8000-000000000001';

const CURRENT: GridState = {
  version: 1,
  filter: { field: 'totalPrice', op: 'gt', value: 10 },
  search: 'x',
  columns: [
    {
      id: 'startsAt',
      visible: true,
      width: 200,
      sort: { order: 'asc', index: 0 },
      relativeDateFilter: { direction: 'from', amount: 0, unit: 'day' },
    },
    { id: 'customer', visible: true, width: 180 },
    {
      id: 'barber',
      visible: false,
      headerFilter: { field: 'staffMemberId', op: 'eq', value: 'b' },
    },
  ],
};

describe('customerViewState', () => {
  const state = customerViewState(CURRENT, CUSTOMER);

  it('filters by the customer and sorts latest first', () => {
    expect(state.columns.find((column) => column.id === 'customer')?.headerFilter).toEqual({
      field: 'customerId',
      op: 'eq',
      value: CUSTOMER,
    });
    expect(state.columns.find((column) => column.id === 'startsAt')?.sort).toEqual({
      order: 'desc',
      index: 0,
    });
  });

  it('drops every other filter, the upcoming one included', () => {
    expect(state.filter).toBeNull();
    expect(state.search).toBeNull();
    const starts = state.columns.find((column) => column.id === 'startsAt');
    expect(starts?.relativeDateFilter).toBeUndefined();
    expect(state.columns.find((column) => column.id === 'barber')?.headerFilter).toBeUndefined();
  });

  it('keeps the arrangement of the columns', () => {
    expect(state.columns.map((column) => [column.id, column.visible, column.width])).toEqual([
      ['startsAt', true, 200],
      ['customer', true, 180],
      ['barber', false, undefined],
    ]);
  });
});
