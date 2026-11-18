import { categorySet, testContext } from '../../testing/dashboard.fixtures';
import type { TooltipFormatter as Formatter } from '../../testing/dashboard.fixtures.types';
import { busyHeatmapOption, weekdayName } from './busy-heatmap.options';
import { HEATMAP_BOTTOM } from './chart-base';
import { isEmptySeriesSet } from './chart-data';

describe('busyHeatmapOption', () => {
  const ctx = testContext();
  const set = categorySet([{ key: '9' }, { key: '10' }], {
    '1': [0, 2],
    '2': [null, 5],
    '6': [3, 11],
  });
  const option = busyHeatmapOption(set, ctx);

  it('puts the hours on x and the weekdays on y, Monday on top', () => {
    expect((option['xAxis'] as { data: string[] }).data).toEqual(['09:00', '10:00']);
    expect(option['yAxis']).toMatchObject({
      data: ['Δευ', 'Τρί', 'Τετ', 'Πέμ', 'Παρ', 'Σάβ', 'Κυρ'],
      inverse: true,
    });
  });

  it('labels every second hour of a long day, as the busiest hours do', () => {
    const hours = Array.from({ length: 13 }, (_, index) => ({ key: String(8 + index) }));
    const long = busyHeatmapOption(categorySet(hours, { '1': hours.map(() => 1) }), ctx);
    const axis = long['xAxis'] as { axisLabel: { interval: number }; splitArea: unknown };
    expect(axis.axisLabel.interval).toBe(1);
    expect(axis.splitArea).toEqual({ show: false });
  });

  it('gives 0 a cell and null none, and a missing weekday no cells', () => {
    const data = (option['series'] as { data: number[][] }[])[0]?.data;
    expect(data).toEqual([
      [0, 0, 0],
      [1, 0, 2],
      [1, 1, 5],
      [0, 5, 3],
      [1, 5, 11],
    ]);
  });

  it('keeps a band under the cells for the hours and the ramp, as its skeleton does', () => {
    expect(option['grid']).toMatchObject({ top: 12, bottom: HEATMAP_BOTTOM });
    expect(HEATMAP_BOTTOM).toBe(60);
  });

  it('ramps from the sunken surface to the accent, up to the largest value', () => {
    expect(option['visualMap']).toMatchObject({
      type: 'continuous',
      min: 0,
      max: 11,
      inRange: { color: ['surface-sunken', 'accent'] },
      text: ['11', '0'],
    });
  });

  it('names the cell in the tooltip', () => {
    const formatter = (option['tooltip'] as { formatter: Formatter }).formatter;
    const html = formatter({ value: [1, 5, 11] });
    expect(html).toContain('Σάβ 10:00');
    expect(html).toContain('Ραντεβού');
    expect(html).toContain('11');
  });

  it('names a series key by its weekday for the table', () => {
    expect(weekdayName('1', ctx)).toBe('Δευ');
    expect(weekdayName('7', ctx)).toBe('Κυρ');
    expect(weekdayName('appointments', ctx)).toBe('Ραντεβού');
  });

  it('reports a set of zeros as empty', () => {
    expect(isEmptySeriesSet(categorySet([{ key: '9' }], { '1': [0], '2': [null] }))).toBe(true);
  });
});
