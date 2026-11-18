import type { SeriesSetViewDto } from '@api/analytics';
import type { ChartOption } from '@ui/chart';

import { swatch } from './chart-colors';
import type { ChartContext } from './chart-options.types';
import { donutOption } from './donut.options';

/** The booking sources, in swatch order. The lead time chart uses the same colors. */
const SOURCE_KEYS: readonly string[] = ['online', 'staff'];

/** A source's swatch: `online` the first, `staff` the second, any other by its `fallback` index. */
export function sourceColor(key: string, ctx: ChartContext, fallback: number): string {
  const index = SOURCE_KEYS.indexOf(key);
  return swatch(ctx, index >= 0 ? index : fallback);
}

/** `bookingSource`: a donut of the appointments, booked online or by the shop. */
export function bookingSourceOption(set: SeriesSetViewDto, ctx: ChartContext): ChartOption {
  return donutOption(set, ctx, 'appointments', (key, index) => ({
    color: sourceColor(key, ctx, index),
    opacity: 1,
  }));
}
