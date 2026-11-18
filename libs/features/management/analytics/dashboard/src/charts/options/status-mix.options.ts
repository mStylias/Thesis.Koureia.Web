import type { SeriesSetViewDto } from '@api/analytics';
import { isAppointmentStatus } from '@features/management-shared-appointments';
import type { ChartOption } from '@ui/chart';

import { statusStyle, swatch } from './chart-colors';
import type { ChartContext } from './chart-options.types';
import { donutOption } from './donut.options';

/**
 * `statusMix`: a donut of the appointments by status. Each slice takes its status tone, lighter
 * for a muted status, as the appointments grid draws it.
 */
export function statusMixOption(set: SeriesSetViewDto, ctx: ChartContext): ChartOption {
  return donutOption(set, ctx, 'appointments', (key, index) =>
    isAppointmentStatus(key)
      ? statusStyle(key, ctx.tokens)
      : { color: swatch(ctx, index), opacity: 1 },
  );
}
