import { APPOINTMENT_STATUS_SPECS } from '@features/management-shared-appointments';

import { categorySet, testContext } from '../../testing/dashboard.fixtures';
import { readLegend } from './chart-base';
import { MUTED_OPACITY } from './chart-colors';
import { isEmptySeriesSet } from './chart-data';
import { statusMixOption } from './status-mix.options';

describe('statusMixOption', () => {
  const ctx = testContext();
  const set = categorySet(
    [
      { key: 'completed' },
      { key: 'confirmed' },
      { key: 'pending' },
      { key: 'cancelled' },
      { key: 'no_show' },
    ],
    { appointments: [264, 6, 0, 17, 12] },
  );
  const option = statusMixOption(set, ctx);

  it('colors each slice by its status tone, as APPOINTMENT_STATUS_SPECS says', () => {
    expect(APPOINTMENT_STATUS_SPECS.cancelled.tone).toBe('neutral');
    expect(readLegend(option)).toEqual([
      {
        name: 'managementAppointments.status.completed',
        color: 'success',
        dashed: false,
        opacity: 1,
      },
      {
        name: 'managementAppointments.status.confirmed',
        color: 'info',
        dashed: false,
        opacity: 1,
      },
      {
        name: 'managementAppointments.status.cancelled',
        color: 'text-muted',
        dashed: false,
        opacity: MUTED_OPACITY,
      },
      {
        name: 'managementAppointments.status.no_show',
        color: 'error',
        dashed: false,
        opacity: MUTED_OPACITY,
      },
    ]);
  });

  it('leaves a status with 0 out of the slices', () => {
    const data = (option['series'] as { data: { value: number }[] }[])[0]?.data;
    expect(data.map((slice) => slice.value)).toEqual([264, 6, 17, 12]);
  });

  it('reports a set of zeros as empty', () => {
    expect(isEmptySeriesSet(categorySet([{ key: 'completed' }], { appointments: [0] }))).toBe(true);
  });
});
