import { aggregateKey, computeAggregates } from './aggregate';
import { applyQueryLocally, createLocalDataSource } from './apply-query';
import { defaultCompare, sortRows } from './sort';
import type { AggregateSpec, SortSpec } from '../types/query.types';

interface Row {
  id: number;
  name: string;
  score: number | null;
  category: string;
  createdAt: Date | null;
}

function rows(): Row[] {
  return [
    {
      id: 1,
      name: 'Ada',
      score: 30,
      category: 'a',
      createdAt: new Date('2024-03-01T00:00:00.000Z'),
    },
    {
      id: 2,
      name: 'Bob',
      score: 10,
      category: 'b',
      createdAt: new Date('2024-01-01T00:00:00.000Z'),
    },
    { id: 3, name: 'Cid', score: null, category: 'a', createdAt: null },
    {
      id: 4,
      name: 'Amy',
      score: 20,
      category: 'b',
      createdAt: new Date('2024-02-01T00:00:00.000Z'),
    },
  ];
}

describe('sortRows', () => {
  it('returns a copy, leaving the input untouched', () => {
    const input = rows();
    const snapshot = [...input];
    sortRows(input, [{ field: 'score' }]);
    expect(input).toEqual(snapshot);
  });

  it('returns a shallow copy of the input when there are no sort specs', () => {
    const input = rows();
    const result = sortRows(input, []);
    expect(result).toEqual(input);
    expect(result).not.toBe(input);
  });

  it('is stable for ties', () => {
    const input: { group: number; order: number }[] = [
      { group: 1, order: 0 },
      { group: 2, order: 1 },
      { group: 1, order: 2 },
      { group: 2, order: 3 },
      { group: 1, order: 4 },
    ];
    const result = sortRows(input, [{ field: 'group' }]);
    const group1Order = result.filter((entry) => entry.group === 1).map((entry) => entry.order);
    const group2Order = result.filter((entry) => entry.group === 2).map((entry) => entry.order);
    expect(group1Order).toEqual([0, 2, 4]);
    expect(group2Order).toEqual([1, 3]);
  });

  it('applies multiple criteria in precedence order', () => {
    const input = [
      { category: 'b', score: 1 },
      { category: 'a', score: 2 },
      { category: 'a', score: 1 },
      { category: 'b', score: 2 },
    ];
    const result = sortRows(input, [{ field: 'category' }, { field: 'score' }]);
    expect(result).toEqual([
      { category: 'a', score: 1 },
      { category: 'a', score: 2 },
      { category: 'b', score: 1 },
      { category: 'b', score: 2 },
    ]);
  });

  it('inverts the order when desc is set', () => {
    const input = [{ score: 1 }, { score: 3 }, { score: 2 }];
    const result = sortRows(input, [{ field: 'score', desc: true }]);
    expect(result.map((entry) => entry.score)).toEqual([3, 2, 1]);
  });

  it('sorts nulls last ascending', () => {
    const input = [{ score: 2 }, { score: null }, { score: 1 }];
    const result = sortRows(input, [{ field: 'score' }]);
    expect(result.map((entry) => entry.score)).toEqual([1, 2, null]);
  });

  it('sorts nulls last when desc too', () => {
    // Regression: the direction sign once inverted null placement.
    const input = [{ score: 2 }, { score: null }, { score: 1 }];
    const result = sortRows(input, [{ field: 'score', desc: true }]);
    expect(result.map((entry) => entry.score)).toEqual([2, 1, null]);
  });

  it('orders Dates by instant, nulls last', () => {
    const result = sortRows(rows(), [{ field: 'createdAt' }]);
    expect(result.map((entry) => entry.name)).toEqual(['Bob', 'Amy', 'Ada', 'Cid']);
  });

  it('consults a getSortValue resolver override for a field', () => {
    const input = [{ name: 'Alexander' }, { name: 'Bo' }, { name: 'Cid' }];
    const spec: SortSpec[] = [{ field: 'name' }];
    const result = sortRows(input, spec, (field) =>
      field === 'name' ? { getSortValue: (row: { name: string }) => row.name.length } : undefined,
    );
    expect(result.map((entry) => entry.name)).toEqual(['Bo', 'Cid', 'Alexander']);
  });

  it('consults a comparator resolver override for a field', () => {
    const spec: SortSpec[] = [{ field: 'name' }];
    const reverseAlpha = (a: unknown, b: unknown) => defaultCompare(b, a);
    const result = sortRows(rows(), spec, (field) =>
      field === 'name' ? { comparator: reverseAlpha } : undefined,
    );
    expect(result.map((entry) => entry.name)).toEqual(['Cid', 'Bob', 'Amy', 'Ada']);
  });
});

describe('aggregateKey', () => {
  it('uses field:type when there is no custom identifier', () => {
    expect(aggregateKey({ field: 'score', type: 'sum' })).toBe('score:sum');
  });

  it('uses the custom identifier when given', () => {
    expect(aggregateKey({ field: 'score', type: 'custom', custom: 'p90' })).toBe('p90');
  });
});

describe('computeAggregates', () => {
  it('count skips null values', () => {
    const result = computeAggregates(rows(), [{ field: 'score', type: 'count' }]);
    expect(result['score:count']).toBe(3);
  });

  it('sum coerces numbers and bigints and skips non-numeric values', () => {
    const values = [{ v: 1 }, { v: 2n }, { v: 'x' }, { v: null }];
    const result = computeAggregates(values, [{ field: 'v', type: 'sum' }]);
    expect(result['v:sum']).toBe(3);
  });

  it('avg coerces numbers and bigints', () => {
    const values = [{ v: 10 }, { v: 20n }, { v: 'x' }];
    const result = computeAggregates(values, [{ field: 'v', type: 'avg' }]);
    expect(result['v:avg']).toBe(15);
  });

  it('avg is null when there are no numeric values', () => {
    const values = [{ v: 'x' }, { v: null }];
    const result = computeAggregates(values, [{ field: 'v', type: 'avg' }]);
    expect(result['v:avg']).toBeNull();
  });

  it('min and max handle mixed nulls', () => {
    const result = computeAggregates(rows(), [
      { field: 'score', type: 'min' },
      { field: 'score', type: 'max' },
    ]);
    expect(result['score:min']).toBe(10);
    expect(result['score:max']).toBe(30);
  });

  it('resolves a custom aggregate from options.customAggregates and receives raw values', () => {
    const spec: AggregateSpec = { field: 'score', type: 'custom', custom: 'joined' };
    const custom = vi.fn((values: readonly unknown[]) => values.join('|'));
    const result = computeAggregates(rows(), [spec], { customAggregates: { joined: custom } });
    expect(result['joined']).toBe('30|10||20');
    expect(custom).toHaveBeenCalledWith([30, 10, null, 20]);
  });

  it('throws when a custom aggregate has no local implementation', () => {
    const spec: AggregateSpec = { field: 'score', type: 'custom', custom: 'missing' };
    expect(() => computeAggregates(rows(), [spec])).toThrow(/missing/);
  });
});

describe('applyQueryLocally', () => {
  it('filters, then searches, then computes totalCount before paging', () => {
    const result = applyQueryLocally(rows(), {
      filter: { field: 'category', op: 'eq', value: 'a' },
      search: 'ada',
      requireTotalCount: true,
      take: 1,
    });
    // Category 'a' rows are Ada and Cid; only Ada's name contains 'ada'.
    expect(result.totalCount).toBe(1);
    expect(result.rows.length).toBe(1);
    expect(result.rows[0].name).toBe('Ada');
  });

  it('computes aggregates over the filtered set', () => {
    const result = applyQueryLocally(rows(), {
      filter: { field: 'category', op: 'eq', value: 'a' },
      aggregates: [{ field: 'score', type: 'sum' }],
    });
    // category 'a' rows are Ada(30) and Cid(null) -> sum skips null.
    expect(result.aggregates).toEqual({ 'score:sum': 30 });
  });

  it('omits aggregates when the query does not request any', () => {
    const result = applyQueryLocally(rows(), {});
    expect(result.aggregates).toBeUndefined();
  });

  it('omits aggregates when the aggregates array is empty', () => {
    const result = applyQueryLocally(rows(), { aggregates: [] });
    expect(result.aggregates).toBeUndefined();
  });

  it('prepends group specs to sort so rows arrive grouped then sorted', () => {
    const result = applyQueryLocally(rows(), {
      group: [{ field: 'category' }],
      sort: [{ field: 'score', desc: true }],
    });
    // Within each category the desc sort still keeps the null score last.
    expect(result.rows.map((row) => [row.category, row.score])).toEqual([
      ['a', 30],
      ['a', null],
      ['b', 20],
      ['b', 10],
    ]);
  });

  it('slices with take but no skip', () => {
    const result = applyQueryLocally(rows(), { take: 2 });
    expect(result.rows.map((row) => row.id)).toEqual([1, 2]);
  });

  it('slices with skip but no take', () => {
    const result = applyQueryLocally(rows(), { skip: 2 });
    expect(result.rows.map((row) => row.id)).toEqual([3, 4]);
  });

  it('slices with both skip and take', () => {
    const result = applyQueryLocally(rows(), { skip: 1, take: 2 });
    expect(result.rows.map((row) => row.id)).toEqual([2, 3]);
  });

  it('uses options.searchFields when given', () => {
    const result = applyQueryLocally(rows(), { search: 'bob' }, { searchFields: ['name'] });
    expect(result.rows.map((row) => row.id)).toEqual([2]);
  });

  it('defaults search fields to the own keys of the first row when unset', () => {
    const result = applyQueryLocally(rows(), { search: 'amy' });
    expect(result.rows.map((row) => row.id)).toEqual([4]);
  });

  it('skips object-valued fields during default search', () => {
    // createdAt is a Date (object) on every row; searching its ISO text must not match.
    const result = applyQueryLocally(rows(), { search: '2024' });
    expect(result.rows).toEqual([]);
  });

  it('search is case-insensitive', () => {
    const result = applyQueryLocally(rows(), { search: 'ADA' });
    expect(result.rows.map((row) => row.id)).toEqual([1]);
  });

  it('does not include totalCount when requireTotalCount is unset', () => {
    const result = applyQueryLocally(rows(), {});
    expect(result.totalCount).toBeUndefined();
  });
});

describe('createLocalDataSource', () => {
  it('resolves a promise with the same shape as applyQueryLocally', async () => {
    const source = createLocalDataSource(() => rows());
    const result = await source.load({ requireTotalCount: true });
    expect(result.rows.length).toBe(4);
    expect(result.totalCount).toBe(4);
  });

  it('re-reads the rows function on every call', async () => {
    let data: Row[] = rows().slice(0, 1);
    const source = createLocalDataSource(() => data);
    const first = await source.load({});
    expect(first.rows.length).toBe(1);
    data = rows();
    const second = await source.load({});
    expect(second.rows.length).toBe(4);
  });
});
