import { categorySet, plainText, testContext } from '../../testing/dashboard.fixtures';
import type { TooltipFormatter as Formatter } from '../../testing/dashboard.fixtures.types';
import { readLegend } from './chart-base';
import { DONUT_LABEL_LINE, DONUT_RADIUS, donutOption } from './donut.options';

describe('donutOption', () => {
  const ctx = testContext();
  const set = categorySet([{ key: 'online' }, { key: 'staff' }, { key: 'other', label: 'Άλλο' }], {
    appointments: [192, 0, null],
  });
  const option = donutOption(set, ctx, 'appointments', (_, index) => ({
    color: `color-${String(index)}`,
    opacity: 1,
  }));
  const series = (option['series'] as Record<string, unknown>[])[0];

  it('draws a slice per item with a value, and none for 0 or null', () => {
    expect(series).toMatchObject({
      type: 'pie',
      name: 'Ραντεβού',
      data: [{ name: 'Online', value: 192, itemStyle: { color: 'color-0', opacity: 1 } }],
    });
  });

  it('gives each slice a legend entry named as the slice', () => {
    expect(readLegend(option)).toEqual([
      { name: 'Online', color: 'color-0', dashed: false, opacity: 1 },
    ]);
  });

  it('shows the value and the share in the tooltip', () => {
    const formatter = (option['tooltip'] as { formatter: Formatter }).formatter;
    const html = plainText(
      formatter({ name: 'Online', value: 192, percent: 68.1, color: 'color-0' }),
    );
    expect(html).toContain('Online');
    expect(html).toContain('192 (68,1%)');
  });

  it('labels a lone slice with its name, share and value: it has no legend', () => {
    const label = (series['label'] as { formatter: Formatter }).formatter;
    expect(plainText(label({ name: 'Online', value: 192, percent: 100 }))).toBe(
      'Online\n100,0%\n192',
    );
  });

  it('labels slices with their share and value, and leaves the name to the legend', () => {
    const two = donutOption(
      categorySet([{ key: 'online' }, { key: 'staff' }], { appointments: [192, 1234] }),
      ctx,
      'appointments',
      (_, index) => ({ color: `color-${String(index)}`, opacity: 1 }),
    );
    const twoSeries = (two['series'] as Record<string, unknown>[])[0] ?? {};
    const label = (twoSeries['label'] as { formatter: Formatter }).formatter;
    const text = plainText(label({ name: 'Από το κατάστημα', value: 1234, percent: 86.5 }));
    expect(text).toBe('86,5%\n1.234');
    expect(text).not.toContain('κατάστημα');
    expect(readLegend(two).map((item) => item.name)).toEqual(['Online', 'Από το κατάστημα']);
  });

  it('leaves room beside the ring for a share label on a phone', () => {
    // A card is about 310px wide on a 390px phone. A chart as high or higher than it is wide
    // gives the ring the most of its width, so that is the worst case.
    const width = 310;
    const outer = (parseFloat(DONUT_RADIUS[1]) / 100) * (width / 2);
    // ECharts puts 5px between the line and the text, and keeps 10px from the edge.
    const room = width / 2 - outer - 2 * DONUT_LABEL_LINE - 5 - 10;
    // "100,0%" at 12px is about 40px wide.
    expect(room).toBeGreaterThanOrEqual(40);
    expect(series).toMatchObject({
      labelLine: { length: DONUT_LABEL_LINE, length2: DONUT_LABEL_LINE },
    });
  });

  it('draws a muted slice with the alpha in its color, so the tooltip marker matches', () => {
    const muted = donutOption(
      categorySet([{ key: 'a' }, { key: 'b' }], { appointments: [3, 4] }),
      ctx,
      'appointments',
      (_, index) => ({ color: 'rgb(138, 125, 112)', opacity: index === 0 ? 1 : 0.5 }),
    );
    const slices = ((muted['series'] as Record<string, unknown>[])[0]?.['data'] ?? []) as {
      itemStyle: unknown;
    }[];
    expect(slices.map((slice) => slice.itemStyle)).toEqual([
      { color: 'rgb(138, 125, 112)', opacity: 1 },
      { color: 'rgba(138, 125, 112, 0.5)', opacity: 1 },
    ]);
    expect(readLegend(muted)[1]).toMatchObject({ color: 'rgb(138, 125, 112)', opacity: 0.5 });
  });
});
