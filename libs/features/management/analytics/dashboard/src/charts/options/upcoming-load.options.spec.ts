import { plainText, testContext, timeSet } from '../../testing/dashboard.fixtures';
import type { TooltipFormatter as Formatter } from '../../testing/dashboard.fixtures.types';
import { readLegend } from './chart-base';
import { isEmptySeriesSet } from './chart-data';
import { isoWeekday, upcomingLoadOption } from './upcoming-load.options';

describe('upcomingLoadOption', () => {
  const ctx = testContext();
  const set = timeSet(
    [
      ['2026-10-04', '2026-10-04'],
      ['2026-10-05', '2026-10-05'],
      ['2026-10-06', '2026-10-06'],
    ],
    { appointments: [0, null, 4], bookedMinutes: [0, null, 175] },
    'Count',
    'Day',
  );
  const option = upcomingLoadOption(set, ctx);
  const series = option['series'] as Record<string, unknown>[];

  it('draws one bar per day, with null as nothing and 0 as a zero', () => {
    expect(series).toHaveLength(1);
    expect(series[0]).toMatchObject({ type: 'bar', color: 'swatch-1', data: [0, null, 4] });
    expect(readLegend(option)).toEqual([]);
  });

  it('labels each day by its date, by the axis granularity', () => {
    expect((option['xAxis'] as { data: string[] }).data).toEqual(['4 Οκτ', '5 Οκτ', '6 Οκτ']);
  });

  it('adds the weekday and the booked time to the tooltip', () => {
    const formatter = (option['tooltip'] as { formatter: Formatter }).formatter;
    const html = plainText(
      formatter([{ dataIndex: 2, seriesName: 'Ραντεβού', value: 4, color: 'swatch-1' }]),
    );
    expect(html).toContain('Τρί 6 Οκτ');
    expect(html).toContain('Χρόνος ραντεβού');
    expect(html).toContain('2 ώ. 55 λ.');
  });

  it('finds the ISO weekday, Sunday as 7', () => {
    expect(isoWeekday('2026-10-04')).toBe(7);
    expect(isoWeekday('2026-10-05')).toBe(1);
    expect(isoWeekday('nonsense')).toBeNull();
    expect(isoWeekday(null)).toBeNull();
  });

  it('reports fourteen empty days as empty', () => {
    expect(
      isEmptySeriesSet(
        timeSet([['2026-10-04', '2026-10-04']], { appointments: [0], bookedMinutes: [0] }),
      ),
    ).toBe(true);
  });
});
