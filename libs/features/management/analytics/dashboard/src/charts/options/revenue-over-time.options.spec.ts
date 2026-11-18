import { plainText, testContext, timeSet } from '../../testing/dashboard.fixtures';
import type { TooltipFormatter as Formatter } from '../../testing/dashboard.fixtures.types';
import { readLegend } from './chart-base';
import { revenueOverTimeOption } from './revenue-over-time.options';

describe('revenueOverTimeOption', () => {
  const ctx = testContext();
  const set = timeSet(
    [
      ['2026-07-07', '2026-07-12'],
      ['2026-07-13', '2026-07-19'],
      ['2026-07-20', '2026-07-26'],
    ],
    { revenue: [402, null, 0], previous: [278, 392, null] },
  );
  const option = revenueOverTimeOption(set, ctx);
  const series = option['series'] as Record<string, unknown>[];

  it('keeps null as a gap and 0 as a zero', () => {
    expect(series[0]).toMatchObject({ data: [402, null, 0], connectNulls: false });
    expect(series[1]).toMatchObject({ data: [278, 392, null], connectNulls: false });
  });

  it('draws revenue solid with an area, and the comparison dashed in the same swatch', () => {
    expect(series[0]).toMatchObject({ type: 'line', color: 'swatch-1', areaStyle: {} });
    expect(series[1]).toMatchObject({ color: 'swatch-1', lineStyle: { type: 'dashed' } });
    expect(series[1]).not.toHaveProperty('areaStyle');
    expect(readLegend(option)).toEqual([
      { name: 'Έσοδα', color: 'swatch-1', dashed: false, opacity: 1 },
      { name: 'Προηγούμενη περίοδος', color: 'swatch-1', dashed: true, opacity: 1 },
    ]);
  });

  it('marks a lone value of a long line, which draws nothing without a marker', () => {
    const days = Array.from({ length: 30 }, (_, index): [string, string] => {
      const day = `2026-09-${String(index + 1).padStart(2, '0')}`;
      return [day, day];
    });
    const long = revenueOverTimeOption(
      timeSet(
        days,
        {
          revenue: days.map((_, index) => (index % 3 === 0 ? 50 : null)),
          previous: days.map(() => 40),
        },
        'Money',
        'Day',
      ),
      ctx,
    );
    const [revenue, previous] = long['series'] as Record<string, unknown>[];
    expect(revenue).toMatchObject({ showSymbol: true, showAllSymbol: true });
    expect(previous).toMatchObject({ showSymbol: false });
  });

  it('marks a lone comparison value, and no other', () => {
    expect(series[1]).toMatchObject({ showSymbol: false });
    const days = Array.from({ length: 30 }, (_, index): [string, string] => {
      const day = `2026-09-${String(index + 1).padStart(2, '0')}`;
      return [day, day];
    });
    const long = revenueOverTimeOption(
      timeSet(
        days,
        {
          revenue: days.map(() => 50),
          previous: days.map((_, index) => (index === 4 ? 40 : null)),
        },
        'Money',
        'Day',
      ),
      ctx,
    );
    const [revenue, previous] = long['series'] as Record<string, unknown>[];
    expect(revenue).toMatchObject({ showSymbol: false });
    expect(previous).toMatchObject({ showSymbol: true });
  });

  it('labels a cut week with its real dates', () => {
    expect((option['xAxis'] as { data: string[] }).data[0]).toBe('7–12 Ιουλ');
  });

  it('gives the comparison value its own dates in the tooltip', () => {
    const formatter = (option['tooltip'] as { formatter: Formatter }).formatter;
    const html = formatter([
      { dataIndex: 1, seriesName: 'Έσοδα', value: null, color: 'swatch-1' },
      { dataIndex: 1, seriesName: 'Προηγούμενη περίοδος', value: 392, color: 'swatch-1' },
    ]);
    expect(html).toContain('13–19 Ιουλ');
    expect(html).toContain('Προηγούμενη περίοδος (13–19 Απρ)');
    expect(html).toContain('—');
    expect(plainText(html)).toContain('392 €');
  });
});
