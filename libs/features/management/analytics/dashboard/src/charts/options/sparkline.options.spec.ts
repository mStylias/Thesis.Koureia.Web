import { testContext, timeSet } from '../../testing/dashboard.fixtures';
import { sparklineOption } from './sparkline.options';

describe('sparklineOption', () => {
  const ctx = testContext();

  it('draws the trend with no axes, gaps at null', () => {
    const option = sparklineOption(
      timeSet(
        [
          ['2026-09-01', '2026-09-07'],
          ['2026-09-08', '2026-09-14'],
          ['2026-09-15', '2026-09-21'],
        ],
        { value: [4.5, 4, null] },
        'Rating',
      ),
      ctx,
    );
    expect(option['xAxis']).toMatchObject({ show: false });
    expect(option['yAxis']).toMatchObject({ show: false });
    expect((option['series'] as Record<string, unknown>[])[0]).toMatchObject({
      data: [4.5, 4, null],
      connectNulls: false,
      color: 'accent',
      showSymbol: false,
    });
  });

  it('marks a single bucket, which a line cannot draw', () => {
    const option = sparklineOption(timeSet([['2026-09-01', '2026-09-07']], { value: [3] }), ctx);
    expect((option['series'] as Record<string, unknown>[])[0]).toMatchObject({ showSymbol: true });
  });

  it('marks only the values with a gap on both sides, and draws every such marker', () => {
    const days = Array.from({ length: 30 }, (_, index): [string, string] => {
      const day = `2026-09-${String(index + 1).padStart(2, '0')}`;
      return [day, day];
    });
    const values = days.map((_, index) =>
      index === 11 || index === 20 || index === 21 ? 5 : null,
    );
    const series = (
      sparklineOption(timeSet(days, { value: values }, 'Rating', 'Day'), ctx)['series'] as Record<
        string,
        unknown
      >[]
    )[0] as {
      showSymbol: boolean;
      showAllSymbol: boolean;
      symbol: (value: unknown, params: { dataIndex: number }) => string;
    };
    expect(series).toMatchObject({ showSymbol: true, showAllSymbol: true });
    const symbols = values.map((value, dataIndex) => series.symbol(value, { dataIndex }));
    expect(symbols[11]).toBe('circle');
    expect(symbols.filter((symbol) => symbol === 'circle')).toHaveLength(1);
  });
});
