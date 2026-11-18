import { plainText, testContext, timeSet } from '../../testing/dashboard.fixtures';
import type { TooltipFormatter as Formatter } from '../../testing/dashboard.fixtures.types';
import { readLegend } from './chart-base';
import { isEmptySeriesSet } from './chart-data';
import { newVsReturningOption } from './new-vs-returning.options';

describe('newVsReturningOption', () => {
  const ctx = testContext();
  const set = timeSet(
    [
      ['2026-07-07', '2026-07-12'],
      ['2026-07-13', '2026-07-19'],
      ['2026-07-20', '2026-07-26'],
    ],
    { new: [1, 0, null], returning: [1219, null, 0] },
    'Count',
  );
  const option = newVsReturningOption(set, ctx);
  const series = option['series'] as Record<string, unknown>[];

  it('keeps null as nothing and 0 as a zero', () => {
    expect(series[0]?.['data']).toEqual([1, 0, null]);
    expect(series[1]?.['data']).toEqual([1219, null, 0]);
  });

  it('stacks new customers on the axis and returning ones above, each in its own swatch', () => {
    expect(series.map((item) => [item['name'], item['stack'], item['color']])).toEqual([
      ['Νέοι', 'customers', 'swatch-1'],
      ['Επιστρέφοντες', 'customers', 'swatch-2'],
    ]);
    expect(readLegend(option)).toEqual([
      { name: 'Νέοι', color: 'swatch-1', dashed: false, opacity: 1 },
      { name: 'Επιστρέφοντες', color: 'swatch-2', dashed: false, opacity: 1 },
    ]);
  });

  it('labels a cut week with its real dates', () => {
    expect((option['xAxis'] as { data: string[] }).data[0]).toBe('7–12 Ιουλ');
  });

  it('lists only the shown series in the tooltip, with grouped counts', () => {
    const formatter = (option['tooltip'] as { formatter: Formatter }).formatter;
    const html = plainText(
      formatter([{ dataIndex: 0, seriesName: 'Επιστρέφοντες', value: 1219, color: 'swatch-2' }]),
    );
    expect(html).toContain('7–12 Ιουλ');
    expect(html).toContain('1.219');
    expect(html).not.toContain('Νέοι');
  });

  it('reports a set of zeros and nulls as empty', () => {
    const empty = timeSet([['2026-07-07', '2026-07-12']], { new: [0], returning: [null] }, 'Count');
    expect(isEmptySeriesSet(empty)).toBe(true);
    expect(isEmptySeriesSet(set)).toBe(false);
  });
});
