import { APPOINTMENT_STATUS_SPECS } from '@features/management-shared-appointments';

import { categorySet, TEST_TOKENS, testContext } from '../../testing/dashboard.fixtures';
import { alphaFill, MUTED_OPACITY, statusBars, statusStyle, swatch } from './chart-colors';

describe('chart colors', () => {
  const ctx = testContext();

  it('draws each status in its tone, and a muted status lighter', () => {
    expect(statusStyle('completed', TEST_TOKENS)).toEqual({ color: 'success', opacity: 1 });
    expect(statusStyle('confirmed', TEST_TOKENS)).toEqual({ color: 'info', opacity: 1 });
    expect(statusStyle('pending', TEST_TOKENS)).toEqual({ color: 'warning', opacity: 1 });
    expect(statusStyle('cancelled', TEST_TOKENS)).toEqual({
      color: 'text-muted',
      opacity: MUTED_OPACITY,
    });
    expect(statusStyle('no_show', TEST_TOKENS)).toEqual({ color: 'error', opacity: MUTED_OPACITY });
    expect(APPOINTMENT_STATUS_SPECS.no_show.muted).toBe(true);
  });

  it('moves the opacity of a hex or rgb() color into its alpha', () => {
    // A theme gives hex at run time. `check-tokens.mjs` names this spec as an exemption.
    expect(alphaFill({ color: '#b23b36', opacity: 0.5 })).toEqual({
      color: 'rgba(178, 59, 54, 0.5)',
      opacity: 1,
    });
    expect(alphaFill({ color: '#abc', opacity: 0.5 })).toEqual({
      color: 'rgba(170, 187, 204, 0.5)',
      opacity: 1,
    });
    expect(alphaFill({ color: 'rgba(10, 20, 30, 0.5)', opacity: 0.5 })).toEqual({
      color: 'rgba(10, 20, 30, 0.25)',
      opacity: 1,
    });
    expect(alphaFill({ color: 'rgb(10 20 30 / 50%)', opacity: 0.5 })).toEqual({
      color: 'rgba(10, 20, 30, 0.25)',
      opacity: 1,
    });
    expect(alphaFill({ color: 'rgb(10, 20, 30)', opacity: 1 })).toEqual({
      color: 'rgb(10, 20, 30)',
      opacity: 1,
    });
    expect(alphaFill({ color: 'oklch(0.5 0.1 30)', opacity: 0.5 })).toEqual({
      color: 'oklch(0.5 0.1 30)',
      opacity: 0.5,
    });
  });

  it('gives a muted status bar the color its tooltip marker shows', () => {
    const hexContext = {
      ...ctx,
      tokens: { ...TEST_TOKENS, success: 'rgb(63, 122, 74)', textMuted: 'rgb(138, 125, 112)' },
    };
    const bars = statusBars(categorySet([{}], { completed: [5], cancelled: [2] }), hexContext);
    expect(bars.series[0]).toMatchObject({ itemStyle: { color: 'rgb(63, 122, 74)', opacity: 1 } });
    // ECharts gives the tooltip `itemStyle.color`, so the alpha must sit in the color.
    expect(bars.series[1]).toMatchObject({
      itemStyle: { color: `rgba(138, 125, 112, ${String(MUTED_OPACITY)})`, opacity: 1 },
    });
    // The legend keeps the plain color: the card draws its opacity.
    expect(bars.legend[1]).toMatchObject({ color: 'rgb(138, 125, 112)', opacity: MUTED_OPACITY });
  });

  it('picks swatches in order and repeats after the sixth', () => {
    expect(swatch(ctx, 0)).toBe('swatch-1');
    expect(swatch(ctx, 6)).toBe('swatch-1');
  });

  it('stacks the statuses that have a value, and leaves the others out of the legend', () => {
    const set = categorySet([{}, {}], {
      pending: [0, 0],
      confirmed: [1, 0],
      completed: [5, 4],
      cancelled: [null, 1],
      no_show: [0, null],
    });
    const bars = statusBars(set, ctx);
    expect(bars.legend.map((item) => item.name)).toEqual([
      'managementAppointments.status.completed',
      'managementAppointments.status.confirmed',
      'managementAppointments.status.cancelled',
    ]);
    expect(bars.series[2]).toMatchObject({
      type: 'bar',
      stack: 'status',
      data: [null, 1],
      itemStyle: { color: 'text-muted', opacity: MUTED_OPACITY },
    });
  });
});
