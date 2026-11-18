import type { SeriesSetViewDto } from '@api/analytics';
import type { ChartOption } from '@ui/chart';

import { swatch } from './chart-colors';
import type { ChartContext } from './chart-options.types';
import { donutOption } from './donut.options';

/** `cancelledBy`: a donut of the cancellations, by the customer and by the shop. */
export function cancelledByOption(set: SeriesSetViewDto, ctx: ChartContext): ChartOption {
  return donutOption(set, ctx, 'appointments', (_, index) => ({
    color: swatch(ctx, index),
    opacity: 1,
  }));
}
