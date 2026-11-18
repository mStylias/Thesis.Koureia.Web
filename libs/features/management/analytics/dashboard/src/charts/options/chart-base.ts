import type { AnalyticsUnit } from '@api/analytics';
import type { ChartOption } from '@ui/chart';

import { hasIsolatedValue } from './chart-data';
import type { ChartContext, ChartLegendItem, TooltipRow } from './chart-options.types';

/** The grid every chart starts from. The legend is `chart-card`'s buttons, so the top is tight. */
export const CHART_GRID = { left: 4, right: 16, top: 12, bottom: 4 } as const;

/**
 * The line sample of a series in the legend of `chart-card` and in the tooltip. A dashed series
 * draws dashes, so two series of one color stay apart in both. The view box has the 4:1 ratio of
 * the marker box (`--space-4` by `--space-1`), so the line fills it.
 */
export const SERIES_MARKER = {
  viewBox: '0 0 16 4',
  y: 2,
  x2: 16,
  strokeWidth: 3,
  dash: '4 2',
} as const;

/** The height of a chart card's chart, unless the tab gives another. */
export const CHART_HEIGHT = '12rem';

/** The height of a wide chart over a time axis. */
export const WIDE_CHART_HEIGHT = '12.5rem';

/** A bar row's height in a horizontal bar chart, in rem. */
const BAR_ROW_REM = 1.75;

/** The value axis below the bars and the inset above them, in rem. */
const BAR_AXIS_REM = 2;

/** The least height of a horizontal bar chart, in rem. */
const BAR_MIN_REM = 8;

/** A weekday row of the heatmap, in rem. */
const HEATMAP_ROW_REM = 1.5;

/** The heatmap's band under the cells, in px: the hour labels and the ramp under them. */
export const HEATMAP_BOTTOM = 60;

/** The grid's top inset and {@link HEATMAP_BOTTOM}, in rem at the 17px root size. */
const HEATMAP_AXIS_REM = 4.25;

/** Up to this many buckets, every point of a line gets a marker. More would crowd the line. */
export const MARKER_LIMIT = 16;

/**
 * The marker settings of a line series. A line shows its markers when it has at most
 * {@link MARKER_LIMIT} buckets, or when a value has `null` on both sides: without a marker that
 * value draws nothing. ECharts must then draw every marker, or it can drop the lone one.
 */
export function lineMarkers(
  values: readonly (number | null)[],
  buckets: number = values.length,
): { readonly showSymbol: boolean; readonly showAllSymbol: boolean } {
  const show = buckets <= MARKER_LIMIT || hasIsolatedValue(values);
  return { showSymbol: show, showAllSymbol: show };
}

/**
 * What every chart shares: the tight grid, an axis tooltip and the ECharts legend hidden behind
 * `chart-card`'s toggle buttons. Spread it first and override what the chart needs.
 */
export function baseOption(ctx: ChartContext): ChartOption {
  return {
    textStyle: { fontFamily: ctx.tokens.fontSans },
    grid: { ...CHART_GRID },
    tooltip: { trigger: 'axis' },
    legend: { show: false },
  };
}

/**
 * The legend of a chart. ECharts keeps it hidden, and `chart-card` reads `legend.data` to draw
 * a toggle button for each entry. A toggle sets `legend.selected`, so the names must match the
 * series names, or the data names of a pie.
 */
export function chartLegend(items: readonly ChartLegendItem[]): Record<string, unknown> {
  return {
    show: false,
    data: items.map((item) => ({
      name: item.name,
      itemStyle: { color: item.color, opacity: item.opacity ?? 1 },
      lineStyle: { color: item.color, type: item.dashed ? 'dashed' : 'solid' },
    })),
  };
}

/** The legend entries `chartLegend` wrote into an option. Empty when it has none. */
export function readLegend(option: ChartOption | null | undefined): ChartLegendItem[] {
  const legend = option?.['legend'];
  const data =
    (legend && !Array.isArray(legend) ? (legend as Record<string, unknown>)['data'] : null) ?? [];
  if (!Array.isArray(data)) return [];
  return data.flatMap((entry: unknown) => {
    if (typeof entry !== 'object' || entry === null) return [];
    const record = entry as {
      name?: unknown;
      itemStyle?: { color?: unknown; opacity?: unknown };
      lineStyle?: { type?: unknown };
    };
    if (typeof record.name !== 'string') return [];
    return [
      {
        name: record.name,
        color: typeof record.itemStyle?.color === 'string' ? record.itemStyle.color : '',
        dashed: record.lineStyle?.type === 'dashed',
        opacity: typeof record.itemStyle?.opacity === 'number' ? record.itemStyle.opacity : 1,
      },
    ];
  });
}

/** A category axis over `labels`. Labels that would overlap are hidden. */
export function categoryAxis(labels: readonly string[]): Record<string, unknown> {
  return {
    type: 'category',
    data: [...labels],
    axisLabel: { hideOverlap: true },
  };
}

/** A value axis whose ticks are formatted by `unit`. */
export function valueAxis(
  unit: AnalyticsUnit,
  ctx: ChartContext,
  extra: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    type: 'value',
    axisLabel: { hideOverlap: true, formatter: (value: number) => ctx.format.axis(value, unit) },
    ...extra,
  };
}

/** The height of a horizontal bar chart with `rows` bars, as a CSS length. At least 8rem. */
export function barChartHeight(rows: number): string {
  return `${String(Math.max(BAR_MIN_REM, rows * BAR_ROW_REM + BAR_AXIS_REM))}rem`;
}

/** The height of a heatmap with `rows` rows, as a CSS length. */
export function heatmapChartHeight(rows: number): string {
  return `${String(rows * HEATMAP_ROW_REM + HEATMAP_AXIS_REM)}rem`;
}

/**
 * The tallest of the rem heights: the one chart height of the cards in a row. A row of two cards
 * then ends level, also before the data arrives.
 */
export function tallestHeight(...heights: readonly string[]): string {
  return heights.reduce((tallest, height) =>
    Number.parseFloat(height) > Number.parseFloat(tallest) ? height : tallest,
  );
}

/**
 * The `axisLabel.interval` that shows at most `most` of `count` labels, evenly spaced. ECharts
 * shows every label that fits, so a dense axis has almost no gap between them.
 */
export function labelInterval(count: number, most: number): number {
  return Math.max(0, Math.ceil(count / Math.max(1, most)) - 1);
}

/** Text for HTML: the tooltip is HTML, and names come from the shop's own data. */
export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** The {@link SERIES_MARKER} of a tooltip row, as the legend of `chart-card` draws it. */
function markerSvg(color: string, dashed: boolean): string {
  const m = SERIES_MARKER;
  const dash = dashed ? ` stroke-dasharray="${m.dash}"` : '';
  return (
    `<svg viewBox="${m.viewBox}" aria-hidden="true" style="flex:none;width:var(--space-4);height:var(--space-1)">` +
    `<line x1="0" y1="${String(m.y)}" x2="${String(m.x2)}" y2="${String(m.y)}" stroke="${escapeHtml(color)}" stroke-width="${String(m.strokeWidth)}"${dash}/></svg>`
  );
}

/**
 * A tooltip body: a title and one line per row, the value aligned at the end. The tooltip is
 * HTML inside the chart's host, so it reads the spacing and type tokens directly.
 */
export function tooltipHtml(title: string, rows: readonly TooltipRow[]): string {
  const lines = rows.map((row) => {
    const marker = row.color === undefined ? '' : markerSvg(row.color, row.dashed === true);
    return (
      `<div style="display:flex;align-items:center;gap:var(--space-2)">${marker}` +
      `<span>${escapeHtml(row.name)}</span>` +
      `<span style="margin-left:auto;padding-left:var(--space-4);font-weight:var(--weight-bold);font-variant-numeric:tabular-nums">${escapeHtml(row.value)}</span></div>`
    );
  });
  return (
    `<div style="font-weight:var(--weight-bold);margin-bottom:var(--space-1)">${escapeHtml(title)}</div>` +
    lines.join('')
  );
}

/** The data index an axis tooltip points at: the first param's. -1 when there is none. */
export function tooltipIndex(params: unknown): number {
  const first = Array.isArray(params) ? (params[0] as unknown) : params;
  const index = (first as { dataIndex?: unknown } | null)?.dataIndex;
  return typeof index === 'number' ? index : -1;
}

/** The series an axis tooltip lists: the shown ones only, by name and color. */
export function tooltipSeries(
  params: unknown,
): { readonly seriesName: string; readonly color: string; readonly value: unknown }[] {
  const list = Array.isArray(params) ? (params as unknown[]) : [params];
  return list.flatMap((entry) => {
    const param = entry as { seriesName?: unknown; color?: unknown; value?: unknown } | null;
    if (!param || typeof param.seriesName !== 'string') return [];
    return [
      {
        seriesName: param.seriesName,
        color: typeof param.color === 'string' ? param.color : '',
        value: param.value,
      },
    ];
  });
}
