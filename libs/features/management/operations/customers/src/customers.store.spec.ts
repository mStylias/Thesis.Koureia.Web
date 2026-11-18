/**
 * The grid's source against the wire: the default order, the search term and the filters the
 * endpoint receives.
 */
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { CustomersApi } from '@api/customers';
import { StaffAccessStore } from '@auth/data-access';
import { odataQueryString, Result, type ODataQuery } from '@synax/client/core';
import { where, type FilterNode } from '@ui/data-source';
import { of } from 'rxjs';

import { CustomersStore } from './customers.store';

const ID = 'a1b2c3d4-0000-4000-8000-000000000001';

describe('the customers source', () => {
  const sent = signal<ODataQuery | null>(null);
  const company = signal<{ id: string; name: string; timezone: string | null } | null>({
    id: 'c1',
    name: 'Shop',
    timezone: null,
  });

  beforeEach(() => {
    sent.set(null);
    TestBed.configureTestingModule({
      providers: [
        CustomersStore,
        {
          provide: StaffAccessStore,
          useValue: { company, staff: signal([]), has: () => true },
        },
        {
          provide: CustomersApi,
          useValue: {
            list: (query: ODataQuery) => {
              sent.set(query);
              return of(Result.Ok({ items: [], totalCount: 0 }));
            },
          },
        },
      ],
    });
  });

  async function wire(
    request: Parameters<CustomersStore['customers']['load']>[0],
  ): Promise<string> {
    await TestBed.inject(CustomersStore).customers.load(request);
    const query = sent();
    if (query === null) {
      throw new Error('nothing was sent');
    }
    return decodeURIComponent(odataQueryString(query));
  }

  async function filterFor(node: FilterNode): Promise<string> {
    await TestBed.inject(CustomersStore).customers.load({ filter: node, skip: 0, take: 25 });
    const query = sent();
    if (query === null) {
      throw new Error('nothing was sent');
    }
    return decodeURIComponent(odataQueryString({ filter: query.filter }));
  }

  it('sorts by name when the grid has no sort of its own', async () => {
    expect(await wire({ skip: 0, take: 25 })).toContain('$orderby=displayName');
  });

  it('keeps the sort the grid asks for', async () => {
    const sentQuery = await wire({
      skip: 0,
      take: 25,
      sort: [{ field: 'visitCount', desc: true }],
    });
    expect(sentQuery).toContain('$orderby=visitCount desc');
    expect(sentQuery).not.toContain('displayName');
  });

  it('sends a phone search as quoted digits', async () => {
    expect(await wire({ skip: 0, take: 25, search: '697 123' })).toContain('$search="697123"');
  });

  it('filters a shop-local day as a bare date, not an instant', async () => {
    expect(await filterFor(where('lastVisitDate', 'ge', new Date(2026, 8, 1)))).toBe(
      '?$filter=lastVisitDate ge 2026-09-01',
    );
  });

  it('sends the preferred barber as a bare GUID, and "No preference" as null', async () => {
    expect(await filterFor(where('preferredStaffMemberId', 'eq', ID))).toBe(
      `?$filter=preferredStaffMemberId eq ${ID}`,
    );
    expect(await filterFor(where('preferredStaffMemberId', 'isNull'))).toBe(
      '?$filter=preferredStaffMemberId eq null',
    );
  });

  it('searches the name folded, on its twin', async () => {
    expect(await filterFor(where('displayName', 'contains', 'Γιώργος'))).toBe(
      "?$filter=contains(nameNormalized,'γιωργος')",
    );
  });

  it("uses the shop's zone once the workspace sends it", () => {
    const store = TestBed.inject(CustomersStore);
    company.set({ id: 'c1', name: 'Shop', timezone: 'Asia/Tokyo' });

    expect(store.timezone()).toBe('Asia/Tokyo');
  });
});
