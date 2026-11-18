import { buildDateBuckets, dateBucketFilter } from './date-buckets';
import { collectDistinctValues } from './distinct-values';

describe('header-filter buckets', () => {
  it('groups exact days into a year, month, and day hierarchy with counts', () => {
    const buckets = buildDateBuckets([
      { value: new Date(2026, 0, 5), count: 2, interval: 'day' },
      { value: new Date(2026, 0, 6), count: 3, interval: 'day' },
      { value: new Date(2026, 1, 1), count: 1, interval: 'day' },
    ]);

    expect(buckets).toHaveLength(1);
    expect(buckets[0].count).toBe(6);
    expect(buckets[0].children).toHaveLength(2);
    expect(buckets[0].children[0].count).toBe(5);
    expect(buckets[0].children[0].children).toHaveLength(2);
  });

  it('compiles one date node to the inclusive range covering its period', () => {
    const month = buildDateBuckets([{ value: new Date(2026, 0, 5), count: 1 }])[0].children[0];

    expect(dateBucketFilter('starts', month)).toEqual({
      field: 'starts',
      op: 'between',
      value: [new Date(2026, 0, 1, 0, 0, 0, 0), new Date(2026, 0, 31, 23, 59, 59, 999)],
    });
  });

  it('builds a complete generated calendar and leaves counts absent', () => {
    const buckets = buildDateBuckets([], {
      generatedRange: { min: new Date(2026, 0, 30), max: new Date(2026, 1, 2) },
    });

    expect(buckets[0].children[0].children).toHaveLength(2);
    expect(buckets[0].children[1].children).toHaveLength(2);
    expect(buckets[0].count).toBeNull();
  });

  it('groups numbers into stable step buckets', () => {
    const values = collectDistinctValues(
      [{ amount: 25 }, { amount: 99 }, { amount: 100 }, { amount: 245 }],
      { field: 'amount', interval: { step: 100 } },
      (row) => row.amount,
    );

    expect(values.map(({ value, count }) => ({ value, count }))).toEqual([
      { value: 0, count: 2 },
      { value: 100, count: 1 },
      { value: 200, count: 1 },
    ]);
  });
});
