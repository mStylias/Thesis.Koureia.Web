import { buildBodyItems, groupFocusKey, isGroupFocusKey } from './body-items';
import { buildGroups, countGroupRows, groupNodesFromResult, groupPathKey } from './group-nodes';
import type { GridBodyItem } from './body-items.types';
import type { GroupResult, GroupSpec } from '../types/query.types';

interface Row {
  id: number;
  city: string;
  team: string;
  score: number;
}

const ROWS: Row[] = [
  { id: 1, city: 'Nicosia', team: 'A', score: 10 },
  { id: 2, city: 'Limassol', team: 'B', score: 20 },
  { id: 3, city: 'Nicosia', team: 'B', score: 30 },
  { id: 4, city: 'Limassol', team: 'A', score: 40 },
  { id: 5, city: 'Nicosia', team: 'A', score: 50 },
];

const BY_CITY: GroupSpec[] = [{ field: 'city' }];

describe('groupPathKey', () => {
  it('is stable for equal paths', () => {
    expect(groupPathKey(['a', 1])).toBe(groupPathKey(['a', 1]));
  });

  it('separates paths that differ only in nesting', () => {
    expect(groupPathKey(['a b'])).not.toBe(groupPathKey(['a', 'b']));
  });

  it('keys two equal dates the same', () => {
    const instant = Date.UTC(2026, 0, 1);
    expect(groupPathKey([new Date(instant)])).toBe(groupPathKey([new Date(instant)]));
  });

  // Untagged, these would share an expansion state and one collapse would
  // close both groups.
  it('distinguishes null from the string "null"', () => {
    expect(groupPathKey([null])).not.toBe(groupPathKey(['null']));
  });

  it('distinguishes a number from the string that prints the same', () => {
    expect(groupPathKey([1])).not.toBe(groupPathKey(['1']));
  });

  it('distinguishes a boolean from its printed form', () => {
    expect(groupPathKey([true])).not.toBe(groupPathKey(['true']));
  });
});

describe('groupFocusKey', () => {
  it('is recognizable as a group key', () => {
    expect(isGroupFocusKey(groupFocusKey(['Nicosia']))).toBe(true);
  });

  it('does not claim an ordinary key', () => {
    expect(isGroupFocusKey('Nicosia')).toBe(false);
    expect(isGroupFocusKey(7)).toBe(false);
  });
});

describe('buildGroups', () => {
  it('returns nothing without a spec', () => {
    expect(buildGroups(ROWS, [])).toEqual([]);
  });

  it('collects rows into one node per value', () => {
    const groups = buildGroups(ROWS, BY_CITY);
    expect(groups.map((group) => group.value)).toEqual(['Limassol', 'Nicosia']);
    expect(groups.map((group) => group.count)).toEqual([2, 3]);
  });

  it('orders the groups even when the rows arrive unsorted', () => {
    const shuffled = [ROWS[2], ROWS[1], ROWS[0]];
    expect(buildGroups(shuffled, BY_CITY).map((group) => group.value)).toEqual([
      'Limassol',
      'Nicosia',
    ]);
  });

  it('honours a descending spec', () => {
    const groups = buildGroups(ROWS, [{ field: 'city', desc: true }]);
    expect(groups.map((group) => group.value)).toEqual(['Nicosia', 'Limassol']);
  });

  it('nests one level per spec and holds rows only at the deepest', () => {
    const groups = buildGroups(ROWS, [{ field: 'city' }, { field: 'team' }]);
    expect(groups[0].rows).toEqual([]);
    expect(groups[0].children.map((child) => child.value)).toEqual(['A', 'B']);
    expect(groups[0].children[0].rows).toHaveLength(1);
  });

  it('carries the full path down the nesting', () => {
    const groups = buildGroups(ROWS, [{ field: 'city' }, { field: 'team' }]);
    expect(groups[1].children[0].path).toEqual(['Nicosia', 'A']);
  });

  it('counts every row under a node, not only its direct ones', () => {
    const groups = buildGroups(ROWS, [{ field: 'city' }, { field: 'team' }]);
    expect(groups[1].count).toBe(3);
    expect(countGroupRows(groups)).toBe(ROWS.length);
  });

  it('computes aggregates over every row under a node', () => {
    const groups = buildGroups(ROWS, [{ field: 'city' }, { field: 'team' }], {
      aggregates: [{ field: 'score', type: 'sum' }],
    });
    expect(groups[1].aggregates?.['score:sum']).toBe(90);
    expect(groups[1].children[0].aggregates?.['score:sum']).toBe(60);
  });

  it('leaves aggregates null when none was asked for', () => {
    expect(buildGroups(ROWS, BY_CITY)[0].aggregates).toBeNull();
  });

  it('reads values through the supplied getter', () => {
    const groups = buildGroups(ROWS, [{ field: 'initial' }], {
      getValue: (row, field) => (field === 'initial' ? row.city[0] : undefined),
    });
    expect(groups.map((group) => group.value)).toEqual(['L', 'N']);
  });

  it('groups nulls together rather than dropping them', () => {
    const rows = [
      { id: 1, city: null },
      { id: 2, city: null },
      { id: 3, city: 'X' },
    ];
    const groups = buildGroups(rows, BY_CITY);
    expect(groups).toHaveLength(2);
    expect(groups.find((group) => group.value == null)?.count).toBe(2);
  });
});

describe('groupNodesFromResult', () => {
  it('adapts a flat remote grouping', () => {
    const remote: GroupResult<Row>[] = [
      { key: 'Nicosia', items: [ROWS[0]], count: 12, aggregates: { 'score:sum': 99 } },
    ];
    const [node] = groupNodesFromResult(remote, BY_CITY);
    expect(node.field).toBe('city');
    expect(node.count).toBe(12);
    expect(node.rows).toHaveLength(1);
    expect(node.aggregates?.['score:sum']).toBe(99);
  });

  it('adapts nested remote groups', () => {
    const remote: GroupResult<Row>[] = [
      { key: 'Nicosia', items: [{ key: 'A', items: [ROWS[0], ROWS[4]] }] },
    ];
    const [node] = groupNodesFromResult(remote, [{ field: 'city' }, { field: 'team' }]);
    expect(node.children).toHaveLength(1);
    expect(node.children[0].field).toBe('team');
    expect(node.children[0].path).toEqual(['Nicosia', 'A']);
    expect(node.count).toBe(2);
  });

  it('stops nesting where the source returned rows, even with specs left', () => {
    const remote: GroupResult<Row>[] = [{ key: 'Nicosia', items: [ROWS[0]] }];
    const [node] = groupNodesFromResult(remote, [{ field: 'city' }, { field: 'team' }]);
    expect(node.children).toEqual([]);
    expect(node.rows).toHaveLength(1);
  });

  it('treats an absent items list as an unloaded group', () => {
    const [node] = groupNodesFromResult([{ key: 'X', count: 50 }], BY_CITY);
    expect(node.rows).toEqual([]);
    expect(node.count).toBe(50);
  });
});

describe('buildBodyItems', () => {
  const heights = { data: 40, group: 32, groupFooter: 28, detail: 200 };
  const base = {
    keyOf: (row: Row) => row.id,
    isGroupExpanded: (): boolean => true,
    isRowExpanded: (): boolean => false,
    groupFooters: false,
    heights,
    startIndex: 0,
  };

  function kinds(items: readonly GridBodyItem<Row>[]): string[] {
    return items.map((item) => item.kind);
  }

  it('passes rows straight through when nothing is grouped', () => {
    const items = buildBodyItems(ROWS, null, base);
    expect(kinds(items)).toEqual(['data', 'data', 'data', 'data', 'data']);
  });

  it('numbers rows from the start index, so a page numbers absolutely', () => {
    const items = buildBodyItems(ROWS.slice(0, 2), null, { ...base, startIndex: 100 });
    expect(items.map((item) => (item.kind === 'data' ? item.dataIndex : -1))).toEqual([100, 101]);
  });

  it('emits a group header before its rows', () => {
    const items = buildBodyItems(ROWS, buildGroups(ROWS, BY_CITY), base);
    expect(kinds(items)).toEqual(['group', 'data', 'data', 'group', 'data', 'data', 'data']);
  });

  it('gives a collapsed group its header and nothing else', () => {
    const items = buildBodyItems(ROWS, buildGroups(ROWS, BY_CITY), {
      ...base,
      isGroupExpanded: () => false,
    });
    expect(kinds(items)).toEqual(['group', 'group']);
  });

  it('skips the row indices a collapsed group hides', () => {
    const groups = buildGroups(ROWS, BY_CITY);
    const items = buildBodyItems(ROWS, groups, {
      ...base,
      isGroupExpanded: (path) => path[0] !== 'Limassol',
    });
    const first = items.find((item) => item.kind === 'data');
    expect(first?.kind === 'data' ? first.dataIndex : -1).toBe(2);
  });

  it('appends a group footer when one is asked for', () => {
    const items = buildBodyItems(ROWS.slice(0, 2), buildGroups(ROWS.slice(0, 2), BY_CITY), {
      ...base,
      groupFooters: true,
    });
    expect(kinds(items)).toEqual(['group', 'data', 'groupFooter', 'group', 'data', 'groupFooter']);
  });

  it('follows an expanded row with its detail region', () => {
    const items = buildBodyItems(ROWS.slice(0, 2), null, {
      ...base,
      isRowExpanded: (key) => key === 1,
    });
    expect(kinds(items)).toEqual(['data', 'detail', 'data']);
  });

  it('gives the detail the height its kind declares', () => {
    const items = buildBodyItems(ROWS.slice(0, 1), null, { ...base, isRowExpanded: () => true });
    expect(items.map((item) => item.height)).toEqual([40, 200]);
  });

  it('records the nesting level on the rows inside a group', () => {
    const items = buildBodyItems(
      ROWS,
      buildGroups(ROWS, [{ field: 'city' }, { field: 'team' }]),
      base,
    );
    const row = items.find((item) => item.kind === 'data');
    expect(row?.level).toBe(2);
  });
});
