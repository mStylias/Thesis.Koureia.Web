import { categorySet, testContext } from '../../testing/dashboard.fixtures';
import type { TooltipFormatter as Formatter } from '../../testing/dashboard.fixtures.types';
import { busiestHoursOption, HOUR_LABELS, hourLabels } from './busiest-hours.options';
import { isEmptySeriesSet } from './chart-data';

describe('busiestHoursOption', () => {
  const ctx = testContext();
  const set = categorySet([{ key: '9' }, { key: '10' }, { key: '11' }], {
    appointments: [14, 0, null],
  });
  const option = busiestHoursOption(set, ctx);

  it('shows the hour keys as times', () => {
    expect(hourLabels(set, ctx)).toEqual(['09:00', '10:00', '11:00']);
    expect((option['xAxis'] as { data: string[] }).data).toEqual(['09:00', '10:00', '11:00']);
  });

  it('labels every hour of a short day', () => {
    const axis = option['xAxis'] as { axisLabel: { interval: number; hideOverlap: boolean } };
    expect(axis.axisLabel).toMatchObject({ interval: 0, hideOverlap: true });
  });

  it('labels every second hour of a long day, so the labels of a half-width card keep a gap', () => {
    const hours = Array.from({ length: 13 }, (_, index) => ({ key: String(8 + index) }));
    const long = busiestHoursOption(
      categorySet(hours, { appointments: hours.map(() => 1) }),
      testContext(),
    );
    const interval = (long['xAxis'] as { axisLabel: { interval: number } }).axisLabel.interval;
    expect(interval).toBe(1);
    const shown = hours.filter((_, index) => index % (interval + 1) === 0);
    expect(shown.length).toBeLessThanOrEqual(HOUR_LABELS);
  });

  it('keeps null as no bar and 0 as a zero', () => {
    expect((option['series'] as Record<string, unknown>[])[0]).toMatchObject({
      type: 'bar',
      color: 'swatch-1',
      data: [14, 0, null],
    });
  });

  it('gives the count in the tooltip', () => {
    const formatter = (option['tooltip'] as { formatter: Formatter }).formatter;
    const html = formatter([{ dataIndex: 0, seriesName: 'Ραντεβού', value: 14 }]);
    expect(html).toContain('09:00');
    expect(html).toContain('14');
  });

  it('reports an empty axis as empty: no bookings and no opening hours', () => {
    expect(isEmptySeriesSet(categorySet([], { appointments: [] }))).toBe(true);
  });
});
