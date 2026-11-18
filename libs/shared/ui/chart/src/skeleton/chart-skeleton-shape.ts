import type {
  ChartSkeletonKind,
  ChartSkeletonRing,
  ChartSkeletonRow,
} from './chart-skeleton.types';

/** The number of bars, rows or ticks per kind when `count` is not set. */
export const CHART_SKELETON_COUNTS: Readonly<Record<ChartSkeletonKind, number>> = {
  line: 6,
  bars: 7,
  'bars-horizontal': 5,
  donut: 0,
  heatmap: 7,
  treemap: 5,
  sparkline: 0,
};

/** The heatmap columns when `columns` is not set. */
export const CHART_SKELETON_COLUMNS = 12;

/** The most bars, rows or columns a skeleton draws. */
export const CHART_SKELETON_MAX = 60;

/** Above this many ticks, every second tick is hidden, as ECharts hides labels that overlap. */
export const CHART_SKELETON_TICK_LIMIT = 12;

/** The gridlines of a `line` or `bars` skeleton. */
export const CHART_SKELETON_RULES = 4;

/** The vertical bar heights, in percent of the plot. The pattern repeats. */
const BAR_HEIGHTS = [58, 76, 44, 88, 66, 52, 82, 38, 72, 62, 92, 48] as const;

/** The label stub widths of a horizontal bar row, in percent of the label column. */
const LABEL_WIDTHS = [80, 64, 74, 56, 70] as const;

/**
 * The wave of a `line` or `sparkline` skeleton, in a `0 0 100 40` view box. It stays between
 * y 10 and y 30, so a round line cap does not touch the edge.
 */
export const CHART_SKELETON_WAVE =
  'M0 30 C 10 27, 16 18, 26 19 S 42 30, 54 25 S 72 10, 84 13 S 96 18, 100 15';

/**
 * The ring of the dashboard donuts: the radius `['32%', '50%']`. ECharts takes a percentage of
 * half the smaller side, and so does a `0 0 100 100` view box that the SVG fits with `meet`.
 */
export function skeletonRing(inner = 32, outer = 50): ChartSkeletonRing {
  const half = 50;
  const innerRadius = (inner / 100) * half;
  const outerRadius = (outer / 100) * half;
  return { radius: (innerRadius + outerRadius) / 2, width: outerRadius - innerRadius };
}

/** A count from an input: a whole number from 1 to {@link CHART_SKELETON_MAX}, or `fallback`. */
export function skeletonCount(value: number | undefined, fallback: number): number {
  if (value === undefined || !Number.isFinite(value) || value < 1) return fallback;
  return Math.min(CHART_SKELETON_MAX, Math.floor(value));
}

/** A number input that can be left out: an attribute string becomes a number. */
export function optionalNumber(value: unknown): number | undefined {
  if (value === undefined || value === null || value === '') return undefined;
  return Number(value);
}

/** The heights of `count` vertical bars, in percent. */
export function skeletonBarHeights(count: number): number[] {
  return Array.from({ length: count }, (_, index) => BAR_HEIGHTS[index % BAR_HEIGHTS.length] ?? 0);
}

/** The rows of a horizontal bar skeleton. The bars get shorter down the list, as a ranking does. */
export function skeletonRows(count: number): ChartSkeletonRow[] {
  return Array.from({ length: count }, (_, index) => ({
    label: LABEL_WIDTHS[index % LABEL_WIDTHS.length] ?? 0,
    bar: Math.max(14, Math.round(94 * 0.86 ** index)),
  }));
}

/** One flag per tick: `true` hides the tick. Above the limit, every second tick is hidden. */
export function skeletonTicks(count: number): boolean[] {
  return Array.from(
    { length: count },
    (_, index) => count > CHART_SKELETON_TICK_LIMIT && index % 2 === 1,
  );
}
