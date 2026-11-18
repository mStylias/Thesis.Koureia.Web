import { categorySet, testContext, timeSet } from '../../testing/dashboard.fixtures';
import {
  axisLabels,
  comparisonBuckets,
  hasIsolatedValue,
  indexesByValue,
  isIsolatedValue,
  isEmptySeriesSet,
  seriesName,
  seriesValues,
  timeBuckets,
  topLevelSet,
} from './chart-data';

describe('chart data helpers', () => {
  const ctx = testContext();

  describe('isEmptySeriesSet', () => {
    it('reports a set of only zeros and nulls, or with no items, as empty', () => {
      expect(isEmptySeriesSet(categorySet([{}, {}], { a: [0, null], b: [null, 0] }))).toBe(true);
      expect(isEmptySeriesSet(categorySet([], { a: [] }))).toBe(true);
      expect(isEmptySeriesSet(null)).toBe(true);
    });

    it('reports a set with one value as not empty', () => {
      expect(isEmptySeriesSet(categorySet([{}, {}], { a: [0, 3] }))).toBe(false);
    });

    it('can look at some series only', () => {
      const set = categorySet([{}], { shown: [0], tooltipOnly: [5] });
      expect(isEmptySeriesSet(set, ['shown'])).toBe(true);
    });
  });

  it('finds a value with a gap or the end on both sides', () => {
    expect(hasIsolatedValue([null, 3, null])).toBe(true);
    expect(hasIsolatedValue([3, null])).toBe(true);
    expect(hasIsolatedValue([3])).toBe(true);
    expect(hasIsolatedValue([3, 4, null, 5, 6])).toBe(false);
    expect(hasIsolatedValue([null, null])).toBe(false);
    expect(isIsolatedValue([null, 0, null], 1)).toBe(true);
    expect(isIsolatedValue([null, 3, 4], 1)).toBe(false);
    expect(isIsolatedValue([null, 3, null], 0)).toBe(false);
  });

  it('gives one value per axis item, null for a missing one', () => {
    const set = categorySet([{}, {}, {}], { a: [1, null] });
    expect(seriesValues(set, 'a')).toEqual([1, null, null]);
    expect(seriesValues(set, 'missing')).toEqual([null, null, null]);
  });

  it('orders by value, largest first, null last', () => {
    expect(indexesByValue([2, null, 5, 2])).toEqual([2, 0, 3, 1]);
  });

  it('keeps the items with no parent', () => {
    const set = categorySet(
      [{ key: 'cat' }, { key: 'svc', parentKey: 'cat' }, { key: 'uncategorized' }],
      { revenue: [10, 10, 4] },
      { revenue: 'Money' },
    );
    const top = topLevelSet(set);
    expect(top.axis.items.map((item) => item.key)).toEqual(['cat', 'uncategorized']);
    expect(top.series[0]?.values).toEqual([10, 4]);
  });

  it('names series, statuses, the comparison and keys with no label', () => {
    expect(seriesName('revenue', ctx)).toBe('Έσοδα');
    expect(seriesName('previous', ctx)).toBe('Προηγούμενη περίοδος');
    expect(seriesName('previous', testContext({ comparison: 'PreviousYear' }))).toBe('Πέρσι');
    expect(seriesName('completed', ctx)).toBe('managementAppointments.status.completed');
    expect(seriesName('mystery', ctx)).toBe('mystery');
    const set = categorySet([{ key: 'uncategorized' }, { key: 'x', label: 'Νίκος Β.' }], {
      a: [1, 2],
    });
    expect(axisLabels(set, ctx)).toEqual(['Χωρίς κατηγορία', 'Νίκος Β.']);
  });

  it('labels a cut first week with its real dates', () => {
    const set = timeSet(
      [
        ['2026-07-07', '2026-07-12'],
        ['2026-07-13', '2026-07-19'],
      ],
      { revenue: [1, 2] },
    );
    expect(axisLabels(set, ctx)).toEqual(['7–12 Ιουλ', '13–19 Ιουλ']);
  });

  describe('timeBuckets', () => {
    it('cuts weeks at Monday and the range ends, as the API does', () => {
      expect(timeBuckets('2026-04-08', '2026-04-21', 'Week')).toEqual([
        { fromDate: '2026-04-08', toDate: '2026-04-12' },
        { fromDate: '2026-04-13', toDate: '2026-04-19' },
        { fromDate: '2026-04-20', toDate: '2026-04-21' },
      ]);
    });

    it('cuts months at the 1st', () => {
      expect(timeBuckets('2026-01-15', '2026-03-03', 'Month')).toEqual([
        { fromDate: '2026-01-15', toDate: '2026-01-31' },
        { fromDate: '2026-02-01', toDate: '2026-02-28' },
        { fromDate: '2026-03-01', toDate: '2026-03-03' },
      ]);
    });

    it('builds the comparison buckets from the period', () => {
      const buckets = comparisonBuckets(ctx.period);
      expect(buckets[0]).toEqual({ fromDate: '2026-04-08', toDate: '2026-04-12' });
      expect(buckets.at(-1)).toEqual({ fromDate: '2026-07-06', toDate: '2026-07-06' });
    });
  });
});
