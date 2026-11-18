import { testContext } from '../../testing/dashboard.fixtures';
import {
  barChartHeight,
  baseOption,
  CHART_HEIGHT,
  chartLegend,
  escapeHtml,
  heatmapChartHeight,
  labelInterval,
  lineMarkers,
  MARKER_LIMIT,
  readLegend,
  tallestHeight,
  tooltipHtml,
  tooltipIndex,
  valueAxis,
  WIDE_CHART_HEIGHT,
} from './chart-base';

describe('chart base helpers', () => {
  const ctx = testContext();

  it('hides the ECharts legend: the card draws its own toggles', () => {
    expect(baseOption(ctx)['legend']).toEqual({ show: false });
  });

  it('writes a legend the card can read back', () => {
    const option = {
      legend: chartLegend([
        { name: 'Έσοδα', color: 'swatch-1' },
        { name: 'Πέρσι', color: 'swatch-1', dashed: true, opacity: 0.5 },
      ]),
    };
    expect(readLegend(option)).toEqual([
      { name: 'Έσοδα', color: 'swatch-1', dashed: false, opacity: 1 },
      { name: 'Πέρσι', color: 'swatch-1', dashed: true, opacity: 0.5 },
    ]);
    expect(readLegend({})).toEqual([]);
    expect(readLegend(null)).toEqual([]);
  });

  it('formats value axis ticks by unit', () => {
    const axis = valueAxis('Percent', ctx) as {
      axisLabel: { formatter: (value: number) => string };
    };
    expect(axis.axisLabel.formatter(40)).toBe('40%');
  });

  it('escapes the names a tooltip shows', () => {
    expect(escapeHtml('<b>"A" & B</b>')).toBe('&lt;b&gt;&quot;A&quot; &amp; B&lt;/b&gt;');
    const html = tooltipHtml('<x>', [{ name: '<script>', value: '1', color: 'swatch-1' }]);
    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;x&gt;');
  });

  it('tells a dashed row from a solid row of one color by its marker', () => {
    const box = document.createElement('div');
    box.innerHTML = tooltipHtml('Τίτλος', [
      { name: 'Έσοδα', value: '1', color: 'swatch-1' },
      { name: 'Πέρσι', value: '2', color: 'swatch-1', dashed: true },
    ]);
    const lines = [...box.querySelectorAll('svg line')];
    expect(lines.map((line) => line.getAttribute('stroke'))).toEqual(['swatch-1', 'swatch-1']);
    expect(lines.map((line) => line.getAttribute('stroke-dasharray'))).toEqual([null, '4 2']);
    expect(box.innerHTML).not.toMatch(/\d+px/);
  });

  it('marks a short line, and a long one only when a value stands alone', () => {
    expect(lineMarkers([1, 2, 3])).toEqual({ showSymbol: true, showAllSymbol: true });
    const long = Array.from({ length: MARKER_LIMIT + 1 }, (): number | null => 4);
    expect(lineMarkers(long)).toEqual({ showSymbol: false, showAllSymbol: false });
    long[0] = null;
    long[2] = null;
    expect(lineMarkers(long)).toEqual({ showSymbol: true, showAllSymbol: true });
    expect(lineMarkers([4, 4], Infinity)).toEqual({ showSymbol: false, showAllSymbol: false });
  });

  it('reads the data index of an axis tooltip', () => {
    expect(tooltipIndex([{ dataIndex: 3 }])).toBe(3);
    expect(tooltipIndex({ dataIndex: 1 })).toBe(1);
    expect(tooltipIndex([])).toBe(-1);
  });

  it('gives a horizontal bar chart a compact row for each bar', () => {
    expect(barChartHeight(1)).toBe('8rem');
    expect(barChartHeight(4)).toBe('9rem');
    expect(barChartHeight(10)).toBe('19.5rem');
  });

  it('keeps the charts compact: a row of cards fits beside the KPI row', () => {
    expect([CHART_HEIGHT, WIDE_CHART_HEIGHT]).toEqual(['12rem', '12.5rem']);
  });

  it('sizes the heatmap by its weekday rows', () => {
    expect(heatmapChartHeight(7)).toBe('14.75rem');
  });

  it('gives the cards of a row the tallest of their heights', () => {
    expect(tallestHeight('14.75rem', '14.25rem')).toBe('14.75rem');
    expect(tallestHeight('12rem', '17.75rem')).toBe('17.75rem');
    expect(tallestHeight('12rem')).toBe('12rem');
  });

  it('spaces the labels evenly, at most the given number', () => {
    expect(labelInterval(7, 7)).toBe(0);
    expect(labelInterval(8, 7)).toBe(1);
    expect(labelInterval(13, 7)).toBe(1);
    expect(labelInterval(15, 7)).toBe(2);
    expect(labelInterval(0, 7)).toBe(0);
    expect(labelInterval(5, 0)).toBe(4);
  });
});
