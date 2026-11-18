import { applyLoadRequest, filterRows, pageRows, searchRows } from './apply-request';

interface Role {
  id: number;
  name: string;
  city: string;
  users: number;
  owner: { name: string };
}

const ROLES: readonly Role[] = [
  { id: 1, name: 'Διαχειριστής', city: 'Αθήνα', users: 12, owner: { name: 'Νίκος' } },
  { id: 2, name: 'Υπάλληλος', city: 'Θεσσαλονίκη', users: 3, owner: { name: 'Μαρία' } },
  { id: 3, name: 'Επισκέπτης', city: 'Αθήνα', users: 40, owner: { name: 'Άννα' } },
];

describe('filterRows', () => {
  it('keeps everything for an absent tree', () => {
    expect(filterRows(ROLES, null)).toBe(ROLES);
  });

  it('runs a condition through the shared predicate', () => {
    const kept = filterRows(ROLES, { field: 'city', op: 'eq', value: 'Αθήνα' });
    expect(kept.map((role) => role.id)).toEqual([1, 3]);
  });

  it('reads a dot path', () => {
    const kept = filterRows(ROLES, { field: 'owner.name', op: 'eq', value: 'Μαρία' });
    expect(kept.map((role) => role.id)).toEqual([2]);
  });

  it('folds accents in contains, so it agrees with the normalized column', () => {
    const kept = filterRows(ROLES, { field: 'city', op: 'contains', value: 'αθηνα' });
    expect(kept.map((role) => role.id)).toEqual([1, 3]);
  });
});

describe('searchRows', () => {
  it('scans every own field when none is declared', () => {
    expect(searchRows(ROLES, 'Θεσσαλονικη').map((role) => role.id)).toEqual([2]);
  });

  it('scans only the declared fields', () => {
    const found = searchRows(ROLES, 'Αθηνα', { searchFields: ['name'] });
    expect(found).toEqual([]);
  });

  it('reads a declared dot path the field scan would otherwise miss', () => {
    const found = searchRows(ROLES, 'αννα', { searchFields: ['owner.name'] });
    expect(found.map((role) => role.id)).toEqual([3]);
  });

  it('searches one computed text when the control declares one', () => {
    const found = searchRows(ROLES, 'νικος', { searchText: (role) => role.owner.name });
    expect(found.map((role) => role.id)).toEqual([1]);
  });

  it('is a no-op for an absent or blank needle', () => {
    expect(searchRows(ROLES, null)).toBe(ROLES);
    expect(searchRows(ROLES, '   ')).toBe(ROLES);
  });
});

describe('pageRows', () => {
  it('is a no-op when neither bound is set', () => {
    expect(pageRows(ROLES, undefined, undefined)).toBe(ROLES);
  });

  it('leaves the far end open when take is absent', () => {
    expect(pageRows(ROLES, 1, undefined).map((role) => role.id)).toEqual([2, 3]);
  });

  it('takes a window', () => {
    expect(pageRows(ROLES, 1, 1).map((role) => role.id)).toEqual([2]);
  });
});

describe('applyLoadRequest', () => {
  it('runs filter, sort and page in that order', () => {
    const result = applyLoadRequest(ROLES, {
      filter: { field: 'city', op: 'eq', value: 'Αθήνα' },
      sort: [{ field: 'users', desc: true }],
      take: 1,
    });
    expect(result.rows.map((role) => role.id)).toEqual([3]);
  });

  it('counts what matched, not what the page holds', () => {
    const result = applyLoadRequest(ROLES, { take: 1, requireTotalCount: true });
    expect(result.rows).toHaveLength(1);
    expect(result.totalCount).toBe(3);
  });

  it('reports no count unless one was asked for', () => {
    expect(applyLoadRequest(ROLES, { take: 1 }).totalCount).toBeUndefined();
  });

  it('reports hasMore without being asked, because a list pages by it', () => {
    expect(applyLoadRequest(ROLES, { take: 2 }).hasMore).toBe(true);
    expect(applyLoadRequest(ROLES, { skip: 2, take: 2 }).hasMore).toBe(false);
    expect(applyLoadRequest(ROLES, {}).hasMore).toBe(false);
  });

  it('measures hasMore against the filtered set, not the whole collection', () => {
    const result = applyLoadRequest(ROLES, {
      filter: { field: 'city', op: 'eq', value: 'Αθήνα' },
      take: 2,
    });
    expect(result.rows).toHaveLength(2);
    expect(result.hasMore).toBe(false);
  });

  it('sorts nulls last in both directions', () => {
    const rows = [{ v: 2 }, { v: null }, { v: 1 }];
    expect(applyLoadRequest(rows, { sort: [{ field: 'v' }] }).rows).toEqual([
      { v: 1 },
      { v: 2 },
      { v: null },
    ]);
    expect(applyLoadRequest(rows, { sort: [{ field: 'v', desc: true }] }).rows).toEqual([
      { v: 2 },
      { v: 1 },
      { v: null },
    ]);
  });
});
