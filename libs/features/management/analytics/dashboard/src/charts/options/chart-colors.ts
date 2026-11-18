import type { SeriesSetViewDto } from '@api/analytics';
import {
  APPOINTMENT_STATUS_SPECS,
  type AppointmentStatus,
  type AppointmentStatusSpec,
} from '@features/management-shared-appointments';
import { chartSwatch, type ChartTokens } from '@ui/chart';

import { hasValue, seriesName, seriesValues } from './chart-data';
import type { ChartContext, StatusBars, StatusSeriesStyle } from './chart-options.types';

/** The opacity of a muted status (cancelled, no-show), as the grid draws it lighter. */
export const MUTED_OPACITY = 0.55;

/** The order statuses stack in, from the axis out: what happened first, then what is lost. */
export const STATUS_STACK_ORDER: readonly AppointmentStatus[] = [
  'completed',
  'confirmed',
  'pending',
  'cancelled',
  'no_show',
];

/** A status tone as a token. `neutral` is the muted text color. */
export function toneColor(tone: AppointmentStatusSpec['tone'], tokens: ChartTokens): string {
  return tone === 'neutral' ? tokens.textMuted : tokens[tone];
}

/** How a status series draws: its tone, lighter when the status is muted. */
export function statusStyle(status: AppointmentStatus, tokens: ChartTokens): StatusSeriesStyle {
  const spec = APPOINTMENT_STATUS_SPECS[status];
  return { color: toneColor(spec.tone, tokens), opacity: spec.muted ? MUTED_OPACITY : 1 };
}

/**
 * A style with its opacity moved into the color's alpha, for a fill that ECharts also reports to
 * the tooltip. ECharts gives the tooltip the color without the opacity, so a muted series would
 * show a full-color marker. A color that is not hex or `rgb()` keeps its opacity.
 */
export function alphaFill(style: StatusSeriesStyle): StatusSeriesStyle {
  if (style.opacity >= 1) return style;
  const channels = rgbChannels(style.color);
  if (!channels) return style;
  const [r, g, b, a] = channels;
  const alpha = Math.round(a * style.opacity * 1000) / 1000;
  return { color: `rgba(${String(r)}, ${String(g)}, ${String(b)}, ${String(alpha)})`, opacity: 1 };
}

/** The red, green, blue and alpha of a hex or `rgb()` color, or `null` when it cannot parse. */
function rgbChannels(color: string): [number, number, number, number] | null {
  const text = color.trim();
  const hex = /^#([0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/i.exec(text)?.[1];
  if (hex) {
    const full = hex.length <= 4 ? hex.replace(/./g, '$&$&') : hex;
    const byte = (at: number): number => parseInt(full.slice(at, at + 2), 16);
    return [byte(0), byte(2), byte(4), full.length === 8 ? byte(6) / 255 : 1];
  }
  const rgb = /^rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)(?:[\s,/]+([\d.]+%?))?\s*\)$/i.exec(
    text,
  );
  if (!rgb) return null;
  // The alpha group is optional, so `at` and not an index.
  const alphaText = rgb.at(4);
  const alpha =
    alphaText === undefined ? 1 : parseFloat(alphaText) / (alphaText.endsWith('%') ? 100 : 1);
  return [Number(rgb[1]), Number(rgb[2]), Number(rgb[3]), alpha];
}

/** Swatch `index` from 0, for series that are no state. Repeats after the sixth. */
export function swatch(ctx: ChartContext, index: number): string {
  return chartSwatch(ctx.tokens, index);
}

/**
 * One stacked bar series per status of the set, in {@link STATUS_STACK_ORDER}, and their legend.
 * A status with every value `0` or `null` is left out of both. A muted status draws with an
 * {@link alphaFill}, so its tooltip marker is as light as its bar.
 */
export function statusBars(set: SeriesSetViewDto, ctx: ChartContext, stack = 'status'): StatusBars {
  const shown = STATUS_STACK_ORDER.filter((status) =>
    seriesValues(set, status).some((value) => hasValue(value)),
  );
  return {
    series: shown.map((status) => {
      const style = alphaFill(statusStyle(status, ctx.tokens));
      return {
        type: 'bar',
        name: seriesName(status, ctx),
        stack,
        data: seriesValues(set, status),
        itemStyle: { color: style.color, opacity: style.opacity },
        emphasis: { focus: 'series' },
      };
    }),
    legend: shown.map((status) => ({
      name: seriesName(status, ctx),
      ...statusStyle(status, ctx.tokens),
    })),
  };
}
