import type { SeriesSetViewDto } from '@api/analytics';

import { axisItem, testContext } from '../../testing/dashboard.fixtures';
import type { TooltipFormatter as Formatter } from '../../testing/dashboard.fixtures.types';
import { bookingLeadTimeOption } from './booking-lead-time.options';
import { readLegend } from './chart-base';
import { isEmptySeriesSet } from './chart-data';

function rangeSet(online: (number | null)[], staff: (number | null)[]): SeriesSetViewDto {
  return {
    axis: {
      kind: 'Range',
      granularity: null,
      items: [
        axisItem({ key: '0', from: 0, to: 0 }),
        axisItem({ key: '1', from: 1, to: 1 }),
        axisItem({ key: '2-3', from: 2, to: 3 }),
        axisItem({ key: '31+', from: 31, to: null }),
      ],
    },
    series: [
      { key: 'online', unit: 'Count', values: online },
      { key: 'staff', unit: 'Count', values: staff },
    ],
  };
}

describe('bookingLeadTimeOption', () => {
  const ctx = testContext();
  const option = bookingLeadTimeOption(rangeSet([34, 30, null, 5], [39, 0, 6, 0]), ctx);
  const series = option['series'] as Record<string, unknown>[];

  it('names the day bands, the same day on top', () => {
    expect(option['yAxis']).toMatchObject({
      data: ['Ίδια ημέρα', '1 ημέρα', '2–3 ημέρες', '31+ ημέρες'],
      inverse: true,
    });
  });

  it('stacks online and the shop in their source swatches', () => {
    expect(series[0]).toMatchObject({
      type: 'bar',
      stack: 'source',
      name: 'Online',
      color: 'swatch-1',
      data: [34, 30, null, 5],
    });
    expect(series[1]).toMatchObject({
      name: 'Από το κατάστημα',
      color: 'swatch-2',
      data: [39, 0, 6, 0],
    });
    expect(readLegend(option).map((item) => item.name)).toEqual(['Online', 'Από το κατάστημα']);
  });

  it('leaves a source with only zeros out', () => {
    const online = bookingLeadTimeOption(rangeSet([1, 2, 3, 4], [0, null, 0, 0]), ctx);
    expect((online['series'] as unknown[]).length).toBe(1);
    expect(readLegend(online)).toHaveLength(1);
  });

  it('lists both sources in the tooltip', () => {
    const formatter = (option['tooltip'] as { formatter: Formatter }).formatter;
    const html = formatter([
      { dataIndex: 2, seriesName: 'Online', value: null, color: 'swatch-1' },
      { dataIndex: 2, seriesName: 'Από το κατάστημα', value: 6, color: 'swatch-2' },
    ]);
    expect(html).toContain('2–3 ημέρες');
    expect(html).toContain('—');
    expect(html).toContain('6');
  });

  it('reports a set of zeros as empty', () => {
    expect(isEmptySeriesSet(rangeSet([0, 0, 0, null], [0, 0, 0, 0]))).toBe(true);
  });
});
