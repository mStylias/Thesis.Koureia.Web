import type { AnalyticsAxisItemViewDto, SeriesSetViewDto } from '@api/analytics';

import { axisItem, testContext } from '../../testing/dashboard.fixtures';
import type { TooltipFormatter as Formatter } from '../../testing/dashboard.fixtures.types';
import { isEmptySeriesSet } from './chart-data';
import { daysBetweenVisitsOption } from './days-between-visits.options';

function rangeSet(
  bands: readonly (readonly [number, number | null])[],
  visits: readonly (number | null)[],
): SeriesSetViewDto {
  const items: AnalyticsAxisItemViewDto[] = bands.map(([from, to]) =>
    axisItem({ key: to === null ? `${from}+` : `${from}-${to}`, from, to }),
  );
  return {
    axis: { kind: 'Range', granularity: null, items },
    series: [{ key: 'visits', unit: 'Count', values: visits }],
  };
}

describe('daysBetweenVisitsOption', () => {
  const ctx = testContext();
  const set = rangeSet(
    [
      [1, 14],
      [15, 28],
      [57, 90],
      [91, null],
    ],
    [62, 0, null, 7],
  );
  const option = daysBetweenVisitsOption(set, ctx);
  const series = option['series'] as Record<string, unknown>[];
  const xAxis = option['xAxis'] as { data: string[]; axisLabel: Record<string, unknown> };

  it('keeps null as nothing and 0 as a zero', () => {
    expect(series[0]).toMatchObject({ type: 'bar', data: [62, 0, null, 7], color: 'swatch-1' });
  });

  it('names the day bands and keeps every label', () => {
    expect(xAxis.data).toEqual(['1–14 ημέρες', '15–28 ημέρες', '57–90 ημέρες', '91+ ημέρες']);
    expect(xAxis.axisLabel).toMatchObject({ interval: 0, hideOverlap: false });
  });

  it('shows the range only on the axis, so a phone fits every label', () => {
    const formatter = xAxis.axisLabel['formatter'] as (value: string) => string;
    expect(xAxis.data.map(formatter)).toEqual(['1–14', '15–28', '57–90', '91+']);
    // A fixed width makes ECharts wrap by its own measure, which can split a word.
    expect(xAxis.axisLabel).not.toHaveProperty('width');
    expect(xAxis.axisLabel).not.toHaveProperty('overflow');
  });

  it('counts visits in the tooltip', () => {
    const formatter = (option['tooltip'] as { formatter: Formatter }).formatter;
    const html = formatter([{ dataIndex: 3, seriesName: 'Επισκέψεις', value: 7 }]);
    expect(html).toContain('91+ ημέρες');
    expect(html).toContain('Επισκέψεις');
    expect(html).toContain('>7<');
  });

  it('reports a set of zeros and nulls as empty', () => {
    expect(
      isEmptySeriesSet(
        rangeSet(
          [
            [1, 14],
            [15, 28],
          ],
          [0, null],
        ),
      ),
    ).toBe(true);
  });
});
