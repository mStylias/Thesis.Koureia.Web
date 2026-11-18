import {
  dashboardQueryRewrite,
  decodeDashboardQuery,
  encodeDashboardQuery,
  rangeChangePatch,
  resolveDashboardFilters,
} from './dashboard-filters.query';
import type { DashboardQuery, DashboardQueryParams } from './dashboard-filters.types';

const TODAY = '2026-10-04';
const CONTEXT = { today: TODAY, staffIds: ['s1', 's2'] };

const DEFAULT: DashboardQuery = {
  tab: 'revenue',
  range: 'last30',
  from: null,
  to: null,
  compareTo: null,
  granularity: null,
  staff: null,
};

function decode(params: DashboardQueryParams): DashboardQuery {
  return decodeDashboardQuery(params, CONTEXT);
}

describe('dashboard query codec', () => {
  it('reads the bare address as the defaults, and writes nothing for them', () => {
    expect(decode({})).toEqual(DEFAULT);
    expect(dashboardQueryRewrite({}, DEFAULT)).toBeNull();
    expect(Object.values(encodeDashboardQuery(DEFAULT)).every((value) => value === null)).toBe(
      true,
    );
  });

  it('round-trips every parameter', () => {
    const query: DashboardQuery = {
      tab: 'lost',
      range: 'custom',
      from: '2026-01-01',
      to: '2026-02-15',
      compareTo: 'PreviousYear',
      granularity: 'Week',
      staff: 's2',
    };
    const params = encodeDashboardQuery(query);
    expect(params).toEqual({
      tab: 'lost',
      range: 'custom',
      from: '2026-01-01',
      to: '2026-02-15',
      compareTo: 'PreviousYear',
      granularity: 'Week',
      staff: 's2',
    });
    expect(decode(params)).toEqual(query);
    expect(dashboardQueryRewrite(params, query)).toBeNull();
  });

  it('stores a preset by its id and resolves it against today', () => {
    const query = decode({ range: 'last7' });
    expect(encodeDashboardQuery(query)['range']).toBe('last7');
    expect(encodeDashboardQuery(query)['from']).toBeNull();
    expect(resolveDashboardFilters(query, TODAY)).toMatchObject({
      preset: 'last7',
      from: '2026-09-28',
      to: TODAY,
    });
    expect(resolveDashboardFilters(query, '2026-12-31').from).toBe('2026-12-25');
  });

  it('falls back to the default for an invalid value and rewrites the address', () => {
    const params = {
      tab: 'nope',
      range: 'forever',
      compareTo: 'Yesterday',
      granularity: 'Hour',
      extra: 'kept',
    };
    expect(decode(params)).toEqual(DEFAULT);
    expect(dashboardQueryRewrite(params, decode(params))).toEqual({
      tab: null,
      range: null,
      compareTo: null,
      granularity: null,
    });
  });

  it('refuses a custom range that is not real, reversed, or longer than 731 days', () => {
    expect(decode({ range: 'custom', from: '2026-02-30', to: '2026-03-01' }).range).toBe('last30');
    expect(decode({ range: 'custom', from: '2026-03-01', to: '2026-02-01' }).range).toBe('last30');
    expect(decode({ range: 'custom', from: '2024-01-01', to: '2026-01-01' }).range).toBe('last30');
    expect(decode({ range: 'custom', from: '2024-01-01', to: '2025-12-31' }).range).toBe('custom');
  });

  it('drops dates that come with a preset', () => {
    const params = { range: 'last90', from: '2026-01-01', to: '2026-01-31' };
    expect(dashboardQueryRewrite(params, decode(params))).toEqual({ from: null, to: null });
  });

  it('writes the default comparison as nothing', () => {
    const params = { compareTo: 'PreviousPeriod' };
    expect(decode(params).compareTo).toBeNull();
    expect(dashboardQueryRewrite(params, decode(params))).toEqual({ compareTo: null });
  });

  it('makes day buckets automatic over 92 days', () => {
    expect(decode({ range: 'last90', granularity: 'Day' }).granularity).toBe('Day');
    expect(decode({ range: 'last12Months', granularity: 'Day' }).granularity).toBeNull();
    expect(decode({ range: 'last12Months', granularity: 'Month' }).granularity).toBe('Month');
  });

  it('drops a barber who is not in the shop', () => {
    expect(decode({ staff: 's1' }).staff).toBe('s1');
    expect(decode({ staff: 'gone' }).staff).toBeNull();
  });

  describe('rangeChangePatch', () => {
    it('stores a preset by id and a picked range as custom dates', () => {
      expect(
        rangeChangePatch(DEFAULT, { preset: 'last90', from: '2026-07-07', to: TODAY }),
      ).toEqual({
        range: 'last90',
        from: null,
        to: null,
      });
      expect(
        rangeChangePatch(DEFAULT, { preset: null, from: '2026-09-01', to: '2026-09-10' }),
      ).toEqual({
        range: 'custom',
        from: '2026-09-01',
        to: '2026-09-10',
      });
    });

    it('ignores the empty value of refused text', () => {
      expect(rangeChangePatch(DEFAULT, { preset: null, from: '', to: '' })).toBeNull();
    });

    it('sets day buckets back to automatic for a range over 92 days', () => {
      const daily = { ...DEFAULT, granularity: 'Day' as const };
      expect(
        rangeChangePatch(daily, { preset: 'last12Months', from: '2025-10-05', to: TODAY }),
      ).toMatchObject({ granularity: null });
      expect(
        rangeChangePatch(daily, { preset: 'last7', from: '2026-09-28', to: TODAY }),
      ).not.toHaveProperty('granularity');
    });
  });
});
