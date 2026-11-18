import { plainText, testContext, timeSet } from '../../testing/dashboard.fixtures';
import type { TooltipFormatter as Formatter } from '../../testing/dashboard.fixtures.types';
import { readLegend } from './chart-base';
import { isEmptySeriesSet } from './chart-data';
import { lostRateOverTimeOption } from './lost-rate-over-time.options';

describe('lostRateOverTimeOption', () => {
  const ctx = testContext();
  const set = timeSet(
    [
      ['2026-07-07', '2026-07-12'],
      ['2026-07-13', '2026-07-19'],
      ['2026-07-20', '2026-07-26'],
    ],
    { cancellationRate: [8.7, null, 0], noShowRate: [0, 4.17, null] },
    'Percent',
  );
  const option = lostRateOverTimeOption(set, ctx);
  const series = option['series'] as Record<string, unknown>[];

  it('keeps null as a gap and 0 as a zero', () => {
    expect(series[0]).toMatchObject({ data: [8.7, null, 0], connectNulls: false });
    expect(series[1]).toMatchObject({ data: [0, 4.17, null], connectNulls: false });
  });

  it('draws the two rates in the first two swatches, with a legend', () => {
    expect(series[0]).toMatchObject({ type: 'line', color: 'swatch-1' });
    expect(series[1]).toMatchObject({ type: 'line', color: 'swatch-2' });
    expect(readLegend(option).map((item) => item.name)).toEqual(['Ακυρώσεις', 'Μη εμφανίσεις']);
  });

  it('starts the percent axis at 0', () => {
    expect(option['yAxis']).toMatchObject({ type: 'value', min: 0 });
  });

  it('shows a rate in the tooltip with one decimal, and null as a dash', () => {
    const formatter = (option['tooltip'] as { formatter: Formatter }).formatter;
    const html = plainText(
      formatter([
        { dataIndex: 0, seriesName: 'Ακυρώσεις', value: 8.7, color: 'swatch-1' },
        { dataIndex: 0, seriesName: 'Μη εμφανίσεις', value: null, color: 'swatch-2' },
      ]),
    );
    expect(html).toContain('7–12 Ιουλ');
    expect(html).toContain('8,7%');
    expect(html).toContain('—');
  });

  it('shows the markers of a long series when a value stands alone between gaps', () => {
    const buckets = Array.from({ length: 20 }, (_, index): [string, string] => {
      const day = `2026-07-${String(index + 1).padStart(2, '0')}`;
      return [day, day];
    });
    const long = lostRateOverTimeOption(
      timeSet(
        buckets,
        {
          cancellationRate: buckets.map((_, index) => (index === 5 ? 10 : null)),
          noShowRate: buckets.map(() => 1),
        },
        'Percent',
        'Day',
      ),
      ctx,
    );
    const longSeries = long['series'] as Record<string, unknown>[];
    expect(longSeries[0]).toMatchObject({ showSymbol: true, showAllSymbol: true });
    expect(longSeries[1]).toMatchObject({ showSymbol: false });
  });

  it('reports buckets with nothing resolved as empty', () => {
    expect(
      isEmptySeriesSet(
        timeSet([['2026-07-07', '2026-07-12']], { cancellationRate: [null], noShowRate: [0] }),
      ),
    ).toBe(true);
  });
});
